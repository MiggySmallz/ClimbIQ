# Rule-based issue detection: rules decide *what* was detected — the LLM only
# verifies against keyframes and enriches. Every threshold is body-scale-
# normalized (torso lengths) and named here so tuning touches constants, not
# logic. Ranking: hand-derived issues (full_crimp_risk) sort below body-level
# issues at equal severity.
from dataclasses import dataclass, field

import numpy as np

from features import ClimbFeatures, FrameFeatures

# --- barn-door: short-window out-and-back lateral hip excursion. A traverse
# moves the hips far but monotonically — only excursions that RETURN count.
BARN_WINDOW_S = 2.0
BARN_EXCURSION_TORSOS = 0.35
BARN_RETURN_TORSOS = 0.15

# --- hip-drop vs the 2 s-window baseline
HIP_DROP_TORSOS = 0.3

# --- bent-arm static hang
BENT_ARM_MAX_DEG = 120.0
BENT_ARM_MIN_S = 1.5
STATIC_HIP_TORSOS = 0.12   # hip motion per frame below this = static hang

# --- poor foot contact: toes pitched up above the heel = weight on the heel
# edge, no purchase. Toe-down is edging and is fine.
TOE_UP_DEG = 35.0

# --- hand-derived (secondary)
CRIMP_RISK_MIN_FRAMES = 3

# --- positives
HEEL_HOOK_MIN_FRAMES = 2

# Segments tolerate one missing/undetected frame inside a run.
RUN_GAP_FRAMES = 1
MIN_RUN_FRAMES = 2

# severity from fraction of climb time affected
SEVERITY_HIGH_RATIO = 0.25
SEVERITY_MEDIUM_RATIO = 0.10

# Rule-authored fallback drills — the LLM refines these; reports stay
# contract-valid even if its structured output fails to parse.
DEFAULT_DRILLS = {
    'barn_door': 'Practice flagging: on steep problems, extend the free leg to counter-balance before each reach.',
    'hip_drop': 'Climb three easy problems keeping hips high and close to the wall the whole way — pause and reset if they sag.',
    'bent_arm_hang': 'Hang rests on straight arms: between moves, drop onto a fully extended arm and relax the bicep before reaching.',
    'full_crimp_risk': 'Favor open-hand or half-crimp on edges during warm-ups to build the habit before it matters on hard moves.',
    'poor_foot_contact': 'Silent feet drill: place each toe deliberately and quietly, watching the foot all the way onto the hold.',
}

HAND_DERIVED_KEYS = {'full_crimp_risk'}


@dataclass
class Issue:
    key: str
    severity: str                 # 'high' | 'medium' | 'low'
    evidence: str
    segments: list[tuple[float, float]]
    drill: str = ''
    affected_s: float = 0.0

    def __post_init__(self):
        if not self.drill:
            self.drill = DEFAULT_DRILLS[self.key]


@dataclass
class PositiveObs:
    key: str
    evidence: str


@dataclass
class RuleResult:
    issues: list[Issue] = field(default_factory=list)   # ranked, worst first
    positives: list[PositiveObs] = field(default_factory=list)
    duration_s: float = 0.0


def _runs(flagged_ts: list[float], all_ts: list[float]) -> list[tuple[float, float]]:
    """Group flagged frame timestamps into segments, tolerating RUN_GAP_FRAMES
    unflagged frames inside a run; drop runs shorter than MIN_RUN_FRAMES."""
    if not flagged_ts:
        return []
    idx = {t: i for i, t in enumerate(all_ts)}
    flagged = sorted(idx[t] for t in flagged_ts)
    segments = []
    start = prev = flagged[0]
    for i in flagged[1:]:
        if i - prev <= RUN_GAP_FRAMES + 1:
            prev = i
            continue
        if prev - start + 1 >= MIN_RUN_FRAMES:
            segments.append((all_ts[start], all_ts[prev]))
        start = prev = i
    if prev - start + 1 >= MIN_RUN_FRAMES:
        segments.append((all_ts[start], all_ts[prev]))
    return segments


def _severity(affected_s: float, duration_s: float) -> str:
    ratio = affected_s / duration_s if duration_s > 0 else 0
    if ratio > SEVERITY_HIGH_RATIO:
        return 'high'
    if ratio > SEVERITY_MEDIUM_RATIO:
        return 'medium'
    return 'low'


def _issue(key: str, evidence: str, segments: list[tuple[float, float]], duration_s: float) -> Issue | None:
    if not segments:
        return None
    affected = sum(e - s for s, e in segments)
    return Issue(
        key=key,
        severity=_severity(affected, duration_s),
        evidence=evidence,
        segments=segments,
        affected_s=affected,
    )


def _detect_barn_door(fs: list[FrameFeatures], torso: float, duration_s: float) -> Issue | None:
    ts, xs = [], []
    for f in fs:
        if f.hip_x is not None:
            ts.append(f.t_s)
            xs.append(f.hip_x / torso)
    flagged: set[float] = set()
    events = 0
    i = 0
    while i < len(ts):
        j = i + 1
        peaked = False
        while j < len(ts) and ts[j] - ts[i] <= BARN_WINDOW_S:
            dev = abs(xs[j] - xs[i])
            if dev > BARN_EXCURSION_TORSOS:
                peaked = True
            elif peaked and dev < BARN_RETURN_TORSOS:
                flagged.update(ts[i:j + 1])
                events += 1
                i = j  # continue scanning after the excursion
                break
            j += 1
        i += 1
    segments = _runs(sorted(flagged), ts)
    if not segments:
        return None
    return _issue(
        'barn_door',
        f'Hips swung out and back on {events} move{"s" if events != 1 else ""}',
        segments, duration_s,
    )


def _detect_hip_drop(fs: list[FrameFeatures], baseline: float, torso: float, duration_s: float) -> Issue | None:
    all_ts = [f.t_s for f in fs if f.hip_height is not None]
    flagged = [
        f.t_s for f in fs
        if f.hip_height is not None
        and (baseline - f.hip_height) / torso > HIP_DROP_TORSOS
    ]
    segments = _runs(flagged, all_ts)
    if not segments:
        return None
    affected = sum(e - s for s, e in segments)
    return _issue(
        'hip_drop',
        f'Hips sagged below the starting baseline for {affected:.0f} s total',
        segments, duration_s,
    )


def _detect_bent_arm_hang(fs: list[FrameFeatures], torso: float, duration_s: float) -> Issue | None:
    all_ts = [f.t_s for f in fs]
    flagged = []
    prev = None
    for f in fs:
        static = False
        if prev is not None and None not in (f.hip_x, f.hip_height, prev.hip_x, prev.hip_height):
            moved = (abs(f.hip_x - prev.hip_x) + abs(f.hip_height - prev.hip_height)) / torso
            static = moved < STATIC_HIP_TORSOS
        prev = f
        if not static:
            continue
        for angle, above in (
            (f.elbow_angle_l, f.wrist_above_shoulder_l),
            (f.elbow_angle_r, f.wrist_above_shoulder_r),
        ):
            if angle is not None and above and angle < BENT_ARM_MAX_DEG:
                flagged.append(f.t_s)
                break
    segments = [s for s in _runs(flagged, all_ts) if s[1] - s[0] >= BENT_ARM_MIN_S]
    if not segments:
        return None
    affected = sum(e - s for s, e in segments)
    return _issue(
        'bent_arm_hang',
        f'Hung on bent arms while static for {affected:.0f} s total',
        segments, duration_s,
    )


def _detect_poor_foot_contact(fs: list[FrameFeatures], duration_s: float) -> Issue | None:
    all_ts = [f.t_s for f in fs]
    flagged = []
    for f in fs:
        for axis, hook in ((f.foot_axis_deg_l, f.heel_hook_l), (f.foot_axis_deg_r, f.heel_hook_r)):
            # A deliberate heel-hook also pitches toes up — don't flag it.
            if axis is not None and axis > TOE_UP_DEG and not hook:
                flagged.append(f.t_s)
                break
    segments = _runs(flagged, all_ts)
    if not segments:
        return None
    return _issue(
        'poor_foot_contact',
        f'Foot contact broke down (toes pitched off the hold) in {len(segments)} stretch{"es" if len(segments) != 1 else ""}',
        segments, duration_s,
    )


def _detect_crimp_risk(fs: list[FrameFeatures], duration_s: float) -> Issue | None:
    all_ts = [f.t_s for f in fs]
    flagged = [f.t_s for f in fs if f.crimp_risk_l or f.crimp_risk_r]
    if len(flagged) < CRIMP_RISK_MIN_FRAMES:
        return None
    segments = _runs(flagged, all_ts)
    if not segments:
        return None
    return _issue(
        'full_crimp_risk',
        f'Full-crimp grip geometry on {len(flagged)} sampled frames',
        segments, duration_s,
    )


def _detect_heel_hook(fs: list[FrameFeatures]) -> PositiveObs | None:
    hooked = [f.t_s for f in fs if f.heel_hook_l or f.heel_hook_r]
    if len(hooked) < HEEL_HOOK_MIN_FRAMES:
        return None
    return PositiveObs(
        key='heel_hook',
        evidence=f'Heel-hook used around {hooked[0]:.0f}s',
    )


_SEVERITY_ORDER = {'high': 0, 'medium': 1, 'low': 2}


def detect_issues(climb: ClimbFeatures) -> RuleResult:
    fs = [f for f in climb.frames if f.detected]
    duration_s = fs[-1].t_s - fs[0].t_s if len(fs) > 1 else 0.0
    torso = climb.median_torso

    candidates = [
        _detect_barn_door(fs, torso, duration_s),
        _detect_hip_drop(fs, climb.hip_baseline, torso, duration_s),
        _detect_bent_arm_hang(fs, torso, duration_s),
        _detect_poor_foot_contact(fs, duration_s),
        _detect_crimp_risk(fs, duration_s),
    ]
    issues = [c for c in candidates if c is not None]
    # Rank: severity first, body-level before hand-derived, then most time affected.
    issues.sort(key=lambda i: (
        _SEVERITY_ORDER[i.severity],
        i.key in HAND_DERIVED_KEYS,
        -i.affected_s,
    ))

    positives = [p for p in [_detect_heel_hook(fs)] if p is not None]
    return RuleResult(issues=issues, positives=positives, duration_s=duration_s)
