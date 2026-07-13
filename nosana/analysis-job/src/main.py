# Job entrypoint (spec §8.1): read the env-var contract, run the pipeline,
# PUT the three artifacts, exit 0. On any failure: PUT the structured error
# JSON (shared/src/error.schema.json) to RESULT_PUT_URL and exit non-zero.
import json
import os
import sys
import tempfile
import time
from pathlib import Path

from artifacts import fetch, put
from evidence import extract_evidence
from features import ClimbFeatures, extract_features
from job_env import JobEnv, JobEnvError, load_job_env
from llm import run_coaching
from llm_context import build_llm_context
from overlay import render_overlay
from pose import PoseEngine, PoseFrame, smooth_keypoints
from rules import RuleResult, detect_issues
from scoring import compute_scores, estimate_grade
from timeline import write_timeline
from video_decode import sample_frames


class StageError(Exception):
    """Pipeline failure tagged with the stage enum from the error contract."""

    def __init__(self, stage: str, message: str):
        super().__init__(message)
        self.stage = stage


def run_pose_stage(env: JobEnv, video_path: Path) -> list[PoseFrame]:
    engine = PoseEngine(device=os.environ.get('POSE_DEVICE', 'cuda'))
    frames: list[PoseFrame] = []
    started = time.monotonic()
    for t_s, frame in sample_frames(video_path, env.params.sample_fps):
        frames.append(engine.process_frame(t_s, frame))
    if not frames:
        raise StageError('pose', 'no frames sampled from video')
    detected = sum(1 for f in frames if f.keypoints is not None)
    if detected == 0:
        raise StageError('pose', 'no person detected in any sampled frame')
    elapsed = time.monotonic() - started
    print(
        f'pose: {len(frames)} frames sampled, {detected} with person '
        f'({100 * detected // len(frames)}%), {elapsed:.1f}s '
        f'({1000 * elapsed / len(frames):.0f} ms/frame)'
    )
    return smooth_keypoints(frames)


def run_pipeline(env: JobEnv, work_dir: Path) -> None:
    video_path = work_dir / 'input.mp4'
    try:
        fetch(env.video_url, video_path)
    except Exception as e:
        raise StageError('download', f'fetching video failed: {e}') from e
    if video_path.stat().st_size == 0:
        raise StageError('download', 'fetched video is empty')

    try:
        pose_frames = run_pose_stage(env, video_path)
    except StageError:
        raise
    except Exception as e:
        raise StageError('pose', f'pose stage failed: {e}') from e

    debug_dir = os.environ.get('DEBUG_POSE_DUMP_DIR')
    if debug_dir:
        dump_debug_frames(video_path, pose_frames, env.params.sample_fps, Path(debug_dir))

    try:
        climb = extract_features(pose_frames)
        rule_result = detect_issues(climb)
        scores = compute_scores(rule_result)
        grade = estimate_grade(climb, env.params.declared_grade)
    except StageError:
        raise
    except Exception as e:
        raise StageError('features', f'feature extraction failed: {e}') from e
    print_feature_stats(climb)
    print_rule_results(rule_result, scores, grade)

    try:
        context = build_llm_context(
            climb, rule_result, scores, env.params, frames_analyzed=len(pose_frames)
        )
        images = extract_evidence(
            video_path, pose_frames, rule_result.issues,
            env.params.sample_fps, work_dir / 'evidence',
        )
    except Exception as e:
        raise StageError('features', f'evidence extraction failed: {e}') from e
    print(f'evidence: {len(images)} images '
          f'({sum(1 for i in images if i.kind == "issue")} issue strips, '
          f'{sum(1 for i in images if i.kind == "context")} context), '
          f'llm_context {len(json.dumps(context))} bytes')
    if debug_dir:
        import shutil
        for img in images:
            shutil.copy(img.path, Path(debug_dir) / img.path.name)
        (Path(debug_dir) / 'llm_context.json').write_text(
            json.dumps(context, indent=2), encoding='utf-8'
        )

    # LLM verification + coaching. The pose ONNX sessions were freed when
    # run_pose_stage's engine went out of scope, so the 3090/4090 VRAM budget
    # (spec §8.1) belongs to Qwen here. SKIP_LLM=1 is local-dev only: it keeps
    # the rest of the pipeline testable without the 17 GB model.
    if os.environ.get('SKIP_LLM') == '1':
        from llm import CoachingOutput
        coaching = CoachingOutput(
            verified={i.key: False for i in rule_result.issues},
            drills={},
            grade_estimate=None,
            coaching_text='[dev] LLM stage skipped via SKIP_LLM=1.',
        )
    else:
        try:
            coaching = run_coaching(context, images)
        except StageError:
            raise
        except Exception as e:
            raise StageError('llm', f'coaching call failed: {e}') from e
    verified_count = sum(coaching.verified.values())
    print(f'llm: {verified_count}/{len(rule_result.issues)} issues verified, '
          f'grade={coaching.grade_estimate}, '
          f'coaching {len(coaching.coaching_text)} chars')

    try:
        overlay_path = work_dir / 'overlay.mp4'
        render_overlay(video_path, pose_frames, env.params.sample_fps, overlay_path)
        timeline_path = work_dir / 'timeline.json'
        write_timeline(climb, timeline_path)
    except Exception as e:
        raise StageError('render', f'overlay/timeline render failed: {e}') from e
    print(f'render: overlay {overlay_path.stat().st_size // 1024} KiB, '
          f'timeline {timeline_path.stat().st_size // 1024} KiB')

    result_body = assemble_result(env, pose_frames, rule_result, scores, grade, coaching)
    result_path = work_dir / 'result.json'
    result_path.write_text(json.dumps(result_body), encoding='utf-8')

    try:
        put(env.overlay_put_url, overlay_path, 'video/mp4')
        put(env.timeline_put_url, timeline_path, 'application/json')
        put(env.result_put_url, result_path, 'application/json')
    except Exception as e:
        raise StageError('upload', f'artifact upload failed: {e}') from e
    print('artifacts uploaded — job complete')


LLM_MODEL_NAME = 'qwen3.6-27b-q4_k_m'


def assemble_result(
    env: JobEnv,
    pose_frames: list[PoseFrame],
    rule_result: RuleResult,
    scores: dict,
    heuristic_grade: str | None,
    coaching,
) -> dict:
    """result.json per the shared contract (shared/src/report.schema.json)."""
    return {
        'version': 1,
        'video_id': env.params.video_id,
        'observations': [
            {
                'key': i.key,
                'severity': i.severity,
                'evidence': i.evidence,
                'segments': [
                    {'start_s': round(s, 1), 'end_s': round(e, 1)} for s, e in i.segments
                ],
                'verified': coaching.verified.get(i.key, False),
                'drill': coaching.drills.get(i.key, i.drill),
            }
            for i in rule_result.issues
        ],
        'positives': [{'key': p.key, 'evidence': p.evidence} for p in rule_result.positives],
        'scores': scores,
        'grade_estimate': coaching.grade_estimate or heuristic_grade,
        'coaching_text': coaching.coaching_text,
        'llm_model': LLM_MODEL_NAME,
        'pipeline': {
            'pose_fps': env.params.sample_fps,
            'frames_analyzed': len(pose_frames),
            'duration_s': round(pose_frames[-1].t_s, 1) if pose_frames else 0.0,
        },
    }


def print_rule_results(result: RuleResult, scores: dict, grade: str | None) -> None:
    print(f'rules: {len(result.issues)} issues, {len(result.positives)} positives '
          f'over {result.duration_s:.0f}s of climbing')
    for i in result.issues:
        segs = ', '.join(f'{s:.1f}-{e:.1f}s' for s, e in i.segments)
        print(f'  [{i.severity}] {i.key}: {i.evidence} ({segs})')
    for p in result.positives:
        print(f'  [+] {p.key}: {p.evidence}')
    print(f'  scores: {scores}, grade_estimate: {grade}')


def print_feature_stats(climb: ClimbFeatures) -> None:
    import numpy as np

    fs = [f for f in climb.frames if f.detected]
    elbows = [a for f in fs for a in (f.elbow_angle_l, f.elbow_angle_r) if a is not None]
    feet = [a for f in fs for a in (f.foot_axis_deg_l, f.foot_axis_deg_r) if a is not None]
    grips = [g for f in fs for g in (f.grip_l, f.grip_r) if g is not None]
    hips_x = [f.hip_x / climb.median_torso for f in fs if f.hip_x is not None]
    hips_h = [f.hip_height / climb.median_torso for f in fs if f.hip_height is not None]
    hooks = sum(1 for f in fs if f.heel_hook_l or f.heel_hook_r)
    risks = sum(1 for f in fs if f.crimp_risk_l or f.crimp_risk_r)
    print(
        f'features: {len(fs)} detected frames, median torso {climb.median_torso:.0f}px\n'
        f'  elbow angles: p10={np.percentile(elbows, 10):.0f} '
        f'median={np.median(elbows):.0f} p90={np.percentile(elbows, 90):.0f} deg '
        f'(n={len(elbows)})\n'
        f'  foot axis: median={np.median(feet):.0f} deg (n={len(feet)}), '
        f'heel-hook frames={hooks}\n'
        f'  grip classified on {len(grips)}/{2 * len(fs)} hand-frames '
        f'({100 * len(grips) // (2 * len(fs))}%): '
        f'{ {g: grips.count(g) for g in set(grips)} or "none confident"}, '
        f'crimp-risk frames={risks}\n'
        f'  hip x-travel: {max(hips_x) - min(hips_x):.2f} torsos; '
        f'hip height range: {max(hips_h) - min(hips_h):.2f} torsos; '
        f'baseline={climb.hip_baseline / climb.median_torso:.2f}'
    )


def dump_debug_frames(
    video_path: Path, pose_frames: list[PoseFrame], sample_fps: float, out_dir: Path
) -> None:
    """Local-dev only: write skeleton-annotated sample frames for visual
    sanity checks (enabled via DEBUG_POSE_DUMP_DIR; never set in production)."""
    import cv2
    import numpy as np
    from rtmlib import draw_skeleton

    out_dir.mkdir(parents=True, exist_ok=True)
    detected = [f for f in pose_frames if f.keypoints is not None]
    picks = {id(detected[i]) for i in np.linspace(0, len(detected) - 1, 8, dtype=int)}
    by_t = {f.t_s: f for f in pose_frames}
    for t_s, frame in sample_frames(video_path, sample_fps):
        f = by_t.get(t_s)
        if f is None or f.keypoints is None or id(f) not in picks:
            continue
        annotated = draw_skeleton(
            frame.copy(),
            f.keypoints[np.newaxis],
            f.kp_scores[np.newaxis],
            openpose_skeleton=False,
            kpt_thr=0.3,
        )
        x1, y1, x2, y2 = (int(v) for v in f.bbox)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.imwrite(str(out_dir / f'pose_{t_s:06.2f}s.jpg'), annotated)


def put_error(env: JobEnv, work_dir: Path, stage: str, message: str) -> None:
    error_body = {
        'version': 1,
        'video_id': env.params.video_id,
        'error': {'stage': stage, 'message': message},
    }
    error_path = work_dir / 'error.json'
    error_path.write_text(json.dumps(error_body), encoding='utf-8')
    put(env.result_put_url, error_path, 'application/json')


def main() -> int:
    try:
        env = load_job_env()
    except JobEnvError as e:
        # No RESULT_PUT_URL to report to — log and fail.
        print(f'fatal: {e}', file=sys.stderr)
        return 2

    with tempfile.TemporaryDirectory(prefix='climbiq-job-') as tmp:
        work_dir = Path(tmp)
        try:
            run_pipeline(env, work_dir)
        except StageError as e:
            print(f'pipeline failed at {e.stage}: {e}', file=sys.stderr)
            put_error(env, work_dir, e.stage, str(e))
            return 1
        except Exception as e:
            print(f'pipeline failed unexpectedly: {e}', file=sys.stderr)
            put_error(env, work_dir, 'unknown', str(e))
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
