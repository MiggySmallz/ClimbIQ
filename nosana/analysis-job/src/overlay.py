# Overlay clip render (spec §8.1): skeleton drawn on the sampled frames,
# encoded to 720p H.264 with ffmpeg. Frames are streamed straight into
# ffmpeg's stdin one at a time (spec §3: never buffer the video). The clip
# plays at sample_fps real-time pacing, so a frame at t=12.4s sits at 12.4s
# in the clip — issue-card seek timestamps (§6) line up 1:1.
import subprocess
from pathlib import Path

import cv2
import numpy as np
from rtmlib import draw_skeleton

from pose import PoseFrame
from video_decode import sample_frames

OUT_HEIGHT = 720
KPT_DRAW_THR = 0.3
X264_CRF = '23'


class OverlayError(Exception):
    pass


def _even(n: int) -> int:
    return n - (n % 2)


def render_overlay(
    video_path: Path, pose_frames: list[PoseFrame], sample_fps: float, out_path: Path
) -> None:
    by_t = {f.t_s: f for f in pose_frames}
    proc: subprocess.Popen | None = None
    out_w = out_h = None
    try:
        for t_s, frame in sample_frames(video_path, sample_fps):
            f = by_t.get(t_s)
            if f is not None and f.keypoints is not None:
                frame = draw_skeleton(
                    frame,
                    f.keypoints[np.newaxis],
                    f.kp_scores[np.newaxis],
                    openpose_skeleton=False,
                    kpt_thr=KPT_DRAW_THR,
                )
            if proc is None:
                h, w = frame.shape[:2]
                scale = OUT_HEIGHT / h
                out_w, out_h = _even(round(w * scale)), _even(round(h * scale))
                proc = subprocess.Popen(
                    [
                        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                        '-f', 'rawvideo', '-pix_fmt', 'bgr24',
                        '-s', f'{out_w}x{out_h}', '-r', str(sample_fps),
                        '-i', 'pipe:0',
                        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', X264_CRF,
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                        str(out_path),
                    ],
                    stdin=subprocess.PIPE,
                )
            proc.stdin.write(cv2.resize(frame, (out_w, out_h)).tobytes())
        if proc is None:
            raise OverlayError('no frames to render')
        proc.stdin.close()
        if proc.wait() != 0:
            raise OverlayError(f'ffmpeg exited {proc.returncode}')
    except BrokenPipeError as e:
        raise OverlayError('ffmpeg closed the pipe early') from e
    finally:
        if proc is not None and proc.poll() is None:
            proc.kill()
