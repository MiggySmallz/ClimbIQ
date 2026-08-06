# Timeline artifact: the per-frame series for the report screen's biomechanics
# chart live in R2 as timeline.json — heavy data never goes in the Postgres
# report row. Values are body-scale-normalized (torsos) so the chart is
# comparable across videos; null = not measurable that frame.
import json
from pathlib import Path

from features import ClimbFeatures

TIMELINE_VERSION = 1


def _norm(value: float | None, torso: float) -> float | None:
    return round(value / torso, 3) if value is not None else None


def _round(value: float | None) -> int | None:
    return round(value) if value is not None else None


def build_timeline(climb: ClimbFeatures) -> dict:
    torso = climb.median_torso
    fs = climb.frames
    return {
        'version': TIMELINE_VERSION,
        'hip_baseline_torsos': round(climb.hip_baseline / torso, 3),
        'series': {
            't_s': [round(f.t_s, 2) for f in fs],
            'hip_x_torsos': [_norm(f.hip_x, torso) for f in fs],
            'hip_height_torsos': [_norm(f.hip_height, torso) for f in fs],
            'elbow_angle_l_deg': [_round(f.elbow_angle_l) for f in fs],
            'elbow_angle_r_deg': [_round(f.elbow_angle_r) for f in fs],
            'foot_axis_l_deg': [_round(f.foot_axis_deg_l) for f in fs],
            'foot_axis_r_deg': [_round(f.foot_axis_deg_r) for f in fs],
        },
    }


def write_timeline(climb: ClimbFeatures, out_path: Path) -> None:
    out_path.write_text(json.dumps(build_timeline(climb)), encoding='utf-8')
