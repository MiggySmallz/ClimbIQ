# Streaming frame sampler: decode sampled frames one at a time at ~sample_fps —
# never the whole video into RAM. grab() skips the decode work for non-sampled
# frames.
from collections.abc import Iterator
from pathlib import Path

import cv2
import numpy as np


class VideoDecodeError(Exception):
    pass


def sample_frames(path: Path, sample_fps: float) -> Iterator[tuple[float, np.ndarray]]:
    """Yield (timestamp_s, BGR frame) at approximately sample_fps."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise VideoDecodeError(f'could not open video: {path.name}')
    try:
        native_fps = cap.get(cv2.CAP_PROP_FPS)
        if not native_fps or native_fps <= 0:
            native_fps = 30.0
        stride = max(1, round(native_fps / sample_fps))
        idx = 0
        while cap.grab():
            if idx % stride == 0:
                ok, frame = cap.retrieve()
                if ok:
                    yield idx / native_fps, frame
            idx += 1
        if idx == 0:
            raise VideoDecodeError('video contains no decodable frames')
    finally:
        cap.release()
