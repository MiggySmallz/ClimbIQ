# llm_context: the one compact structured summary the LLM receives — ranked
# issues with evidence and timestamps, positives, grip distribution, scores.
# Never bulk keypoints, never per-frame series.
from features import ClimbFeatures
from job_env import JobParams
from rules import RuleResult


def build_llm_context(
    climb: ClimbFeatures,
    result: RuleResult,
    scores: dict[str, int],
    params: JobParams,
    frames_analyzed: int,
) -> dict:
    detected = [f for f in climb.frames if f.detected]
    grips = [g for f in detected for g in (f.grip_l, f.grip_r)]
    classified = [g for g in grips if g is not None]
    grip_distribution = {
        'crimp': classified.count('crimp'),
        'open_hand': classified.count('open_hand'),
        'unclassified': len(grips) - len(classified),
    }

    return {
        'video': {
            'duration_s': round(result.duration_s, 1),
            'frames_analyzed': frames_analyzed,
            'declared_grade': params.declared_grade,
        },
        'issues': [
            {
                'key': i.key,
                'severity': i.severity,
                'evidence': i.evidence,
                'segments': [[round(s, 1), round(e, 1)] for s, e in i.segments],
            }
            for i in result.issues
        ],
        'positives': [{'key': p.key, 'evidence': p.evidence} for p in result.positives],
        'grip_distribution': grip_distribution,
        'scores': scores,
    }
