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
from job_env import JobEnv, JobEnvError, load_job_env
from pose import PoseEngine, PoseFrame, smooth_keypoints
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

    # Features, LLM, render, upload stages land in M2.9–M2.18.
    raise StageError('features', 'pipeline not implemented past pose yet')


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
