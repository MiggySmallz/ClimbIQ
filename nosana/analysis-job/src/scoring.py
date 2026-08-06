# Scores + grade estimate: transparent heuristic from issue counts/severities —
# labeled "beta" in the UI. Grip is weighted least in the overall score (hand
# features are secondary and their detection is the least reliable).
from features import ClimbFeatures
from rules import RuleResult

_PENALTY = {'high': 30, 'medium': 18, 'low': 8}

_CATEGORY_KEYS = {
    'balance': ['barn_door'],
    'footwork': ['poor_foot_contact'],
    'grip': ['full_crimp_risk'],
    'body_position': ['hip_drop', 'bent_arm_hang'],
}

_HEEL_HOOK_FOOTWORK_BONUS = 5

_OVERALL_WEIGHTS = {
    'balance': 0.3,
    'footwork': 0.3,
    'body_position': 0.3,
    'grip': 0.1,
}


def compute_scores(result: RuleResult) -> dict[str, int]:
    scores: dict[str, int] = {}
    for category, keys in _CATEGORY_KEYS.items():
        value = 100
        for issue in result.issues:
            if issue.key in keys:
                value -= _PENALTY[issue.severity]
        if category == 'footwork' and any(p.key == 'heel_hook' for p in result.positives):
            value += _HEEL_HOOK_FOOTWORK_BONUS
        scores[category] = max(0, min(100, value))
    overall = sum(scores[c] * w for c, w in _OVERALL_WEIGHTS.items())
    scores['overall'] = round(overall)
    return scores


def estimate_grade(climb: ClimbFeatures, declared_grade: str | None) -> str | None:
    """v1: route grade isn't derivable from technique features alone (a V0
    climbed sloppily is still a V0), so the heuristic anchors on the declared
    grade when given and otherwise abstains — the LLM stage may refine from what
    it sees."""
    return declared_grade
