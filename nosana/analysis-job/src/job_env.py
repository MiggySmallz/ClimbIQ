# Entrypoint env-var contract: everything the job needs arrives via env vars.
# URLs are presigned HTTP(S) in production; file:// or plain local paths behind
# the same interface for local dev.
import base64
import binascii
import json
import os
from dataclasses import dataclass


class JobEnvError(Exception):
    """Missing or malformed env contract — fail before any work starts."""


@dataclass(frozen=True)
class JobParams:
    video_id: str
    sample_fps: float
    # Climber-declared grade, e.g. "V4"; informs the LLM prompt only.
    declared_grade: str | None


@dataclass(frozen=True)
class JobEnv:
    video_url: str
    result_put_url: str
    overlay_put_url: str
    timeline_put_url: str
    params: JobParams


def _require(name: str) -> str:
    value = os.environ.get(name, '').strip()
    if not value:
        raise JobEnvError(f'missing required env var {name}')
    return value


def load_job_env() -> JobEnv:
    # JOB_PARAMS is base64-encoded JSON, not raw JSON: Nosana's node corrupts a
    # JSON-object-looking env var in transit to the container, while base64
    # arrives intact. Encoded by buildEnv in jobDefinition.ts.
    encoded = _require('JOB_PARAMS')
    try:
        raw_params = base64.b64decode(encoded, validate=True).decode('utf-8')
    except (binascii.Error, ValueError, UnicodeDecodeError) as e:
        raise JobEnvError(f'JOB_PARAMS is not valid base64: {e}') from e
    try:
        parsed = json.loads(raw_params)
    except json.JSONDecodeError as e:
        raise JobEnvError(f'JOB_PARAMS is not valid JSON: {e}') from e
    if not isinstance(parsed, dict):
        raise JobEnvError('JOB_PARAMS must be a JSON object')

    video_id = parsed.get('video_id')
    if not isinstance(video_id, str) or not video_id:
        raise JobEnvError('JOB_PARAMS.video_id must be a non-empty string')

    sample_fps = parsed.get('sample_fps', 30.0)
    if not isinstance(sample_fps, (int, float)) or sample_fps <= 0:
        raise JobEnvError('JOB_PARAMS.sample_fps must be a positive number')

    declared_grade = parsed.get('declared_grade')
    if declared_grade is not None and not isinstance(declared_grade, str):
        raise JobEnvError('JOB_PARAMS.declared_grade must be a string if present')

    return JobEnv(
        video_url=_require('VIDEO_URL'),
        result_put_url=_require('RESULT_PUT_URL'),
        overlay_put_url=_require('OVERLAY_PUT_URL'),
        timeline_put_url=_require('TIMELINE_PUT_URL'),
        params=JobParams(
            video_id=video_id,
            sample_fps=float(sample_fps),
            declared_grade=declared_grade,
        ),
    )
