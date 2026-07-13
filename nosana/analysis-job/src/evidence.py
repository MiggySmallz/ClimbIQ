# Evidence image extraction (spec §8.1): for each top issue, 3–5 bbox-cropped
# frames spanning its segments composed into ONE labeled strip — motion *is*
# the evidence for dynamic faults; an isolated still can't show a barn-door.
# Plus 2–3 evenly spaced whole-climb context frames. Total images are
# hard-capped to protect the VRAM/token budget (spec §8.1).
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from pose import PoseFrame
from rules import Issue
from video_decode import sample_frames

MAX_ISSUE_STRIPS = 3      # top issues that get an evidence strip
FRAMES_PER_STRIP = 4      # spec: 3–5
CONTEXT_FRAMES = 2        # spec: 2–3 whole-climb frames
# → hard cap: 3 strips + 2 context = 5 images per job

TILE_HEIGHT = 360         # px per cropped tile in a strip
CONTEXT_MAX_DIM = 896     # px, longest side of a context frame
BBOX_PAD = 0.25           # crop padding as a fraction of bbox size
LABEL_BAR_PX = 28
JPEG_QUALITY = 85


@dataclass
class EvidenceImage:
    path: Path
    kind: str           # 'issue' | 'context'
    issue_key: str | None
    caption: str        # what the LLM is told this image shows


def _issue_timestamps(issue: Issue) -> list[float]:
    """Pick FRAMES_PER_STRIP timestamps spanning the issue's segments,
    proportionally to segment length."""
    spans = [(s, e) for s, e in issue.segments]
    total = sum(e - s for s, e in spans) or 1e-6
    ts: list[float] = []
    for frac in np.linspace(0.0, 1.0, FRAMES_PER_STRIP):
        target = frac * total
        acc = 0.0
        for s, e in spans:
            if acc + (e - s) >= target:
                ts.append(s + (target - acc))
                break
            acc += e - s
        else:
            ts.append(spans[-1][1])
    return ts


def _nearest_pose_frame(t: float, pose_frames: list[PoseFrame]) -> PoseFrame:
    return min(pose_frames, key=lambda f: abs(f.t_s - t))


def _crop_person(frame: np.ndarray, bbox: np.ndarray | None) -> np.ndarray:
    if bbox is None:
        return frame
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = bbox
    pad_x, pad_y = (x2 - x1) * BBOX_PAD, (y2 - y1) * BBOX_PAD
    x1, x2 = max(0, int(x1 - pad_x)), min(w, int(x2 + pad_x))
    y1, y2 = max(0, int(y1 - pad_y)), min(h, int(y2 + pad_y))
    if x2 <= x1 or y2 <= y1:
        return frame
    return frame[y1:y2, x1:x2]


def _label(img: np.ndarray, text: str) -> np.ndarray:
    bar = np.zeros((LABEL_BAR_PX, img.shape[1], 3), dtype=np.uint8)
    cv2.putText(bar, text, (6, LABEL_BAR_PX - 9), cv2.FONT_HERSHEY_SIMPLEX,
                0.55, (255, 255, 255), 1, cv2.LINE_AA)
    return np.vstack([bar, img])


def _resize_h(img: np.ndarray, height: int) -> np.ndarray:
    scale = height / img.shape[0]
    return cv2.resize(img, (max(1, round(img.shape[1] * scale)), height))


def _compose_strip(tiles: list[np.ndarray], header: str) -> np.ndarray:
    gap = np.zeros((tiles[0].shape[0], 4, 3), dtype=np.uint8)
    row: list[np.ndarray] = []
    for i, tile in enumerate(tiles):
        if i:
            row.append(gap)
        row.append(tile)
    strip = np.hstack(row)
    return _label(strip, header)


def extract_evidence(
    video_path: Path,
    pose_frames: list[PoseFrame],
    issues: list[Issue],
    sample_fps: float,
    out_dir: Path,
) -> list[EvidenceImage]:
    """One streaming decode pass collects every frame any strip/context image
    needs; nothing else is held in memory."""
    out_dir.mkdir(parents=True, exist_ok=True)
    top_issues = issues[:MAX_ISSUE_STRIPS]

    wanted: dict[float, list[tuple[str, int]]] = {}  # pose t_s → [(use, slot)]
    strip_ts: dict[str, list[float]] = {}
    for issue in top_issues:
        ts = [
            _nearest_pose_frame(t, pose_frames).t_s for t in _issue_timestamps(issue)
        ]
        strip_ts[issue.key] = ts
        for slot, t in enumerate(ts):
            wanted.setdefault(t, []).append((issue.key, slot))

    detected = [f for f in pose_frames if f.keypoints is not None]
    span = detected[-1].t_s - detected[0].t_s if len(detected) > 1 else 0.0
    context_ts = []
    for frac in np.linspace(0.25, 0.75, CONTEXT_FRAMES):
        t = _nearest_pose_frame(detected[0].t_s + frac * span, pose_frames).t_s
        context_ts.append(t)
        wanted.setdefault(t, []).append(('__context__', len(context_ts) - 1))

    strip_tiles: dict[str, dict[int, np.ndarray]] = {k: {} for k in strip_ts}
    context_imgs: dict[int, np.ndarray] = {}
    by_t = {f.t_s: f for f in pose_frames}
    for t_s, frame in sample_frames(video_path, sample_fps):
        uses = wanted.get(t_s)
        if not uses:
            continue
        for key, slot in uses:
            if key == '__context__':
                scale = CONTEXT_MAX_DIM / max(frame.shape[:2])
                img = cv2.resize(frame, None, fx=scale, fy=scale) if scale < 1 else frame
                context_imgs[slot] = _label(img.copy(), f'whole climb, t={t_s:.1f}s')
            else:
                tile = _crop_person(frame, by_t[t_s].bbox)
                tile = _resize_h(tile, TILE_HEIGHT)
                strip_tiles[key][slot] = _label(tile, f't={t_s:.1f}s')

    images: list[EvidenceImage] = []
    for issue in top_issues:
        tiles = [strip_tiles[issue.key][s] for s in sorted(strip_tiles[issue.key])]
        if not tiles:
            continue
        # Tiles vary in width (bbox aspect); equalize height before hstack.
        height = min(t.shape[0] for t in tiles)
        tiles = [_resize_h(t, height) for t in tiles]
        strip = _compose_strip(tiles, f'issue: {issue.key} ({issue.severity})')
        path = out_dir / f'evidence_{issue.key}.jpg'
        cv2.imwrite(str(path), strip, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        images.append(EvidenceImage(
            path=path,
            kind='issue',
            issue_key=issue.key,
            caption=(
                f'{FRAMES_PER_STRIP} frames left-to-right spanning the '
                f'"{issue.key}" detection ({issue.evidence})'
            ),
        ))
    for slot in sorted(context_imgs):
        path = out_dir / f'context_{slot}.jpg'
        cv2.imwrite(str(path), context_imgs[slot], [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        images.append(EvidenceImage(
            path=path,
            kind='context',
            issue_key=None,
            caption=f'whole-climb context frame at t={context_ts[slot]:.1f}s',
        ))
    return images
