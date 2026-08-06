# Feature extraction from smoothed 2D keypoints. Ground rules: every threshold is
# normalized to body scale (torso length in px), never absolute pixels; baselines
# come from percentiles over a time window, never a single frame. Image
# coordinates are y-down; "height" below means -y so bigger = higher.
#
# Hand/finger features are secondary: 2D finger tracking on climbing footage
# (chalk, occlusion, motion blur) is too unreliable to lead coaching, so
# grip/crimp classification is gated behind HAND_CONF_MIN and only reported when
# confident; body-level features (hips, elbows, feet) carry the analysis.
from dataclasses import dataclass

import numpy as np

from pose import PoseFrame

# --- confidence gates ---
KP_CONF_MIN = 0.3    # body/foot keypoints below this are treated as missing
HAND_CONF_MIN = 0.5  # hands need a higher bar (see module docstring)

# --- COCO-WholeBody keypoint indices (133 kpts: 17 body, 6 feet, 68 face, 2×21 hands) ---
L_SHOULDER, R_SHOULDER = 5, 6
L_ELBOW, R_ELBOW = 7, 8
L_WRIST, R_WRIST = 9, 10
L_HIP, R_HIP = 11, 12
L_KNEE, R_KNEE = 13, 14
L_ANKLE, R_ANKLE = 15, 16
L_BIGTOE, L_HEEL = 17, 19
R_BIGTOE, R_HEEL = 20, 22
L_HAND_BASE, R_HAND_BASE = 91, 112  # each hand: wrist + 4 kpts per finger (thumb..pinky)

# Fingers as (mcp, pip, dip, tip) offsets from the hand base — thumb excluded,
# its joint naming differs and it contributes little to grip class.
_FINGERS = [(5, 6, 7, 8), (9, 10, 11, 12), (13, 14, 15, 16), (17, 18, 19, 20)]

# --- classification thresholds (beta — tune against real footage) ---
ELBOW_STRAIGHT_DEG = 150.0   # above ⇒ straight-arm hang
PIP_CRIMP_FLEX_DEG = 120.0   # mean PIP angle below ⇒ fingers strongly flexed (crimp-like)
PIP_OPEN_DEG = 150.0         # mean PIP angle above ⇒ open-hand / drag
DIP_HYPEREXT_DEG = 195.0     # signed DIP angle beyond ⇒ hyperextension (full-crimp risk)
FOOT_TOE_DOWN_DEG = -25.0    # heel→toe axis pointing down ⇒ edging/smearing toe contact
FOOT_HEEL_HOOK_KNEE_MARGIN = 0.15  # heel above knee by this ×torso ⇒ heel-hook posture


@dataclass
class FrameFeatures:
    t_s: float
    detected: bool
    torso_len: float | None = None          # px — the frame's normalization unit
    hip_x: float | None = None              # px, hip-center
    hip_height: float | None = None         # -y px, hip-center
    elbow_angle_l: float | None = None      # deg at elbow, 180 = straight
    elbow_angle_r: float | None = None
    wrist_above_shoulder_l: bool = False    # hanging-posture indicators
    wrist_above_shoulder_r: bool = False
    foot_axis_deg_l: float | None = None    # heel→toe vs horizontal, +up
    foot_axis_deg_r: float | None = None
    heel_hook_l: bool = False
    heel_hook_r: bool = False
    grip_l: str | None = None               # 'crimp' | 'open_hand' | None (unknown)
    grip_r: str | None = None
    crimp_risk_l: bool = False              # only ever True on confident frames
    crimp_risk_r: bool = False


@dataclass
class ClimbFeatures:
    frames: list[FrameFeatures]
    # 90th-percentile hip height over the first 2 s of detected climbing,
    # normalized by median torso length (never frame 0).
    hip_baseline: float
    median_torso: float


def _pt(kps: np.ndarray, scores: np.ndarray, idx: int, conf: float) -> np.ndarray | None:
    return kps[idx] if scores[idx] >= conf else None


def _angle_at(a: np.ndarray, vertex: np.ndarray, b: np.ndarray) -> float:
    """Unsigned angle a-vertex-b in degrees, 180 = collinear."""
    v1, v2 = a - vertex, b - vertex
    n1, n2 = np.linalg.norm(v1), np.linalg.norm(v2)
    if n1 < 1e-6 or n2 < 1e-6:
        return 180.0
    cos = np.clip(np.dot(v1, v2) / (n1 * n2), -1.0, 1.0)
    return float(np.degrees(np.arccos(cos)))


def _torso_len(kps: np.ndarray, scores: np.ndarray) -> float | None:
    sides = []
    for sh, hip in ((L_SHOULDER, L_HIP), (R_SHOULDER, R_HIP)):
        s, h = _pt(kps, scores, sh, KP_CONF_MIN), _pt(kps, scores, hip, KP_CONF_MIN)
        if s is not None and h is not None:
            sides.append(float(np.linalg.norm(s - h)))
    return float(np.mean(sides)) if sides else None


def _elbow(kps, scores, sh_i, el_i, wr_i) -> tuple[float | None, bool]:
    sh = _pt(kps, scores, sh_i, KP_CONF_MIN)
    el = _pt(kps, scores, el_i, KP_CONF_MIN)
    wr = _pt(kps, scores, wr_i, KP_CONF_MIN)
    if sh is None or el is None or wr is None:
        return None, False
    angle = _angle_at(sh, el, wr)
    above = wr[1] < sh[1]  # y-down: smaller y = higher
    return angle, above


def _foot(kps, scores, heel_i, toe_i, knee_i, torso: float) -> tuple[float | None, bool]:
    heel = _pt(kps, scores, heel_i, KP_CONF_MIN)
    toe = _pt(kps, scores, toe_i, KP_CONF_MIN)
    if heel is None or toe is None:
        return None, False
    axis = float(np.degrees(np.arctan2(heel[1] - toe[1], toe[0] - heel[0])))
    # Normalize to [-90, 90]: the sign of "toe above/below heel" is what
    # matters, not which way the climber faces.
    if axis > 90:
        axis = 180 - axis
    elif axis < -90:
        axis = -180 - axis
    knee = _pt(kps, scores, knee_i, KP_CONF_MIN)
    heel_hook = (
        knee is not None
        and (knee[1] - heel[1]) > FOOT_HEEL_HOOK_KNEE_MARGIN * torso
    )
    return axis, heel_hook


def _grip(kps, scores, base: int) -> tuple[str | None, bool]:
    """Confidence-gated grip class. Returns (class, crimp_risk); (None, False)
    unless every joint of every finger clears HAND_CONF_MIN — partial hands
    misclassify far too often to act on."""
    pip_angles, dip_angles = [], []
    for mcp_o, pip_o, dip_o, tip_o in _FINGERS:
        joints = [
            _pt(kps, scores, base + o, HAND_CONF_MIN)
            for o in (mcp_o, pip_o, dip_o, tip_o)
        ]
        if any(j is None for j in joints):
            return None, False
        mcp, pip, dip, tip = joints
        pip_angles.append(_angle_at(mcp, pip, dip))
        dip_angles.append(_angle_at(pip, dip, tip))
    mean_pip = float(np.mean(pip_angles))
    if mean_pip < PIP_CRIMP_FLEX_DEG:
        # Full-crimp risk: PIP strongly flexed while DIPs bend past straight
        # the other way. Unsigned 2D angles can't see the hyperextension
        # direction, so require DIPs near-straight AND PIPs deeply flexed —
        # the geometry that precedes hyperextension.
        risk = float(np.mean(dip_angles)) > (360.0 - DIP_HYPEREXT_DEG)
        return 'crimp', risk
    if mean_pip > PIP_OPEN_DEG:
        return 'open_hand', False
    return None, False


def extract_frame(f: PoseFrame) -> FrameFeatures:
    if f.keypoints is None:
        return FrameFeatures(t_s=f.t_s, detected=False)
    kps, scores = f.keypoints, f.kp_scores
    torso = _torso_len(kps, scores)
    if torso is None or torso < 1e-6:
        return FrameFeatures(t_s=f.t_s, detected=False)

    l_hip = _pt(kps, scores, L_HIP, KP_CONF_MIN)
    r_hip = _pt(kps, scores, R_HIP, KP_CONF_MIN)
    hips = [h for h in (l_hip, r_hip) if h is not None]
    hip = np.mean(hips, axis=0) if hips else None

    el_l, above_l = _elbow(kps, scores, L_SHOULDER, L_ELBOW, L_WRIST)
    el_r, above_r = _elbow(kps, scores, R_SHOULDER, R_ELBOW, R_WRIST)
    foot_l, hook_l = _foot(kps, scores, L_HEEL, L_BIGTOE, L_KNEE, torso)
    foot_r, hook_r = _foot(kps, scores, R_HEEL, R_BIGTOE, R_KNEE, torso)
    grip_l, risk_l = _grip(kps, scores, L_HAND_BASE)
    grip_r, risk_r = _grip(kps, scores, R_HAND_BASE)

    return FrameFeatures(
        t_s=f.t_s,
        detected=True,
        torso_len=torso,
        hip_x=float(hip[0]) if hip is not None else None,
        hip_height=-float(hip[1]) if hip is not None else None,
        elbow_angle_l=el_l,
        elbow_angle_r=el_r,
        wrist_above_shoulder_l=above_l,
        wrist_above_shoulder_r=above_r,
        foot_axis_deg_l=foot_l,
        foot_axis_deg_r=foot_r,
        heel_hook_l=hook_l,
        heel_hook_r=hook_r,
        grip_l=grip_l,
        grip_r=grip_r,
        crimp_risk_l=risk_l,
        crimp_risk_r=risk_r,
    )


def extract_features(pose_frames: list[PoseFrame]) -> ClimbFeatures:
    frames = [extract_frame(f) for f in pose_frames]
    with_hip = [f for f in frames if f.detected and f.hip_height is not None]
    if len(with_hip) < 3:
        raise ValueError('too few frames with a detected climber to build a baseline')

    torsos = np.array([f.torso_len for f in frames if f.torso_len is not None])
    median_torso = float(np.median(torsos))

    # Baseline window: first 2 s of *detected climbing* — measured from the first
    # detected frame, never frame 0 of the video.
    t0 = with_hip[0].t_s
    window = [f for f in with_hip if f.t_s <= t0 + 2.0] or with_hip[:3]
    hip_baseline = float(np.percentile([f.hip_height for f in window], 90))

    return ClimbFeatures(frames=frames, hip_baseline=hip_baseline, median_torso=median_torso)
