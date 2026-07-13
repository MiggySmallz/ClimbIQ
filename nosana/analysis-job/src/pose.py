# Pose stage (spec §8.1, §14.3): YOLOX person bboxes per frame → track the
# largest/most-central person → RTMW wholebody on the tracked bbox only
# (never full-frame, spec §3) → 5-frame median temporal smoothing.
#
# Models are loaded once at construction (spec §3); frames are processed
# strictly sequentially — that is the pipeline's explicit concurrency cap (1).
from dataclasses import dataclass

import numpy as np
from rtmlib import RTMPose, YOLOX, Wholebody

# Same models the image bakes (scripts/bake_models.py) — constructing from
# Wholebody.MODE guarantees the rtmlib cache hit instead of a runtime download.
_MODE = Wholebody.MODE['performance']

# Below this IoU the detection is treated as a different person than the one
# being tracked, and selection falls back to largest/most-central.
_TRACK_IOU_MIN = 0.2


@dataclass
class PoseFrame:
    t_s: float
    bbox: np.ndarray | None       # xyxy, None when no person detected
    keypoints: np.ndarray | None  # (133, 2) px
    kp_scores: np.ndarray | None  # (133,)


def _iou(a: np.ndarray, b: np.ndarray) -> float:
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    if x2 <= x1 or y2 <= y1:
        return 0.0
    inter = (x2 - x1) * (y2 - y1)
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    return float(inter / (area_a + area_b - inter))


def _select_person(
    bboxes: np.ndarray, prev_bbox: np.ndarray | None, frame_shape: tuple
) -> np.ndarray | None:
    """Track by IoU continuity with the previous frame; when that breaks
    (first frame, occlusion, person lost), fall back to largest/most-central
    (spec §14.3 default for multiple climbers)."""
    if len(bboxes) == 0:
        return None
    if prev_bbox is not None:
        ious = np.array([_iou(b, prev_bbox) for b in bboxes])
        best = int(ious.argmax())
        if ious[best] >= _TRACK_IOU_MIN:
            return bboxes[best]
    h, w = frame_shape[:2]

    def centrality_weighted_area(b: np.ndarray) -> float:
        area = (b[2] - b[0]) * (b[3] - b[1])
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        dist = np.hypot((cx - w / 2) / w, (cy - h / 2) / h)
        return float(area * (1.0 - min(dist, 1.0)))

    return max(bboxes, key=centrality_weighted_area)


class PoseEngine:
    def __init__(self, device: str = 'cuda'):
        self._det = YOLOX(
            _MODE['det'],
            model_input_size=_MODE['det_input_size'],
            backend='onnxruntime',
            device=device,
        )
        self._pose = RTMPose(
            _MODE['pose'],
            model_input_size=_MODE['pose_input_size'],
            backend='onnxruntime',
            device=device,
        )
        self._prev_bbox: np.ndarray | None = None

    def process_frame(self, t_s: float, frame: np.ndarray) -> PoseFrame:
        bboxes = self._det(frame)
        bbox = _select_person(np.asarray(bboxes), self._prev_bbox, frame.shape)
        if bbox is None:
            return PoseFrame(t_s=t_s, bbox=None, keypoints=None, kp_scores=None)
        self._prev_bbox = bbox
        keypoints, scores = self._pose(frame, bboxes=[bbox])
        return PoseFrame(t_s=t_s, bbox=bbox, keypoints=keypoints[0], kp_scores=scores[0])


def smooth_keypoints(frames: list[PoseFrame], window: int = 5) -> list[PoseFrame]:
    """Temporal smoothing (spec §8.1): centered median over `window` detected
    frames, per keypoint coordinate. Undetected frames pass through and don't
    contribute to neighbours' medians."""
    detected = [i for i, f in enumerate(frames) if f.keypoints is not None]
    if len(detected) < 3:
        return frames
    half = window // 2
    stack = np.stack([frames[i].keypoints for i in detected])  # (D, 133, 2)
    smoothed = list(frames)
    for pos, i in enumerate(detected):
        lo, hi = max(0, pos - half), min(len(detected), pos + half + 1)
        f = frames[i]
        smoothed[i] = PoseFrame(
            t_s=f.t_s,
            bbox=f.bbox,
            keypoints=np.median(stack[lo:hi], axis=0),
            kp_scores=f.kp_scores,
        )
    return smoothed
