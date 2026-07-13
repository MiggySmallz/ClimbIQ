# Job entrypoint (spec §8.1): read the env-var contract, run the pipeline,
# PUT the three artifacts, exit 0. On any failure: PUT the structured error
# JSON (shared/src/error.schema.json) to RESULT_PUT_URL and exit non-zero.
import json
import sys
import tempfile
from pathlib import Path

from artifacts import fetch, put
from job_env import JobEnv, JobEnvError, load_job_env


class StageError(Exception):
    """Pipeline failure tagged with the stage enum from the error contract."""

    def __init__(self, stage: str, message: str):
        super().__init__(message)
        self.stage = stage


def run_pipeline(env: JobEnv, work_dir: Path) -> None:
    video_path = work_dir / 'input.mp4'
    try:
        fetch(env.video_url, video_path)
    except Exception as e:
        raise StageError('download', f'fetching video failed: {e}') from e
    if video_path.stat().st_size == 0:
        raise StageError('download', 'fetched video is empty')

    # Pose, features, LLM, render, upload stages land in M2.6–M2.18.
    raise StageError('pose', 'pipeline not implemented past download yet')


def put_error(env: JobEnv, work_dir: Path, stage: str, message: str) -> None:
    error_body = {
        'version': 1,
        'video_id': env.params.video_id,
        'error': {'stage': stage, 'message': message},
    }
    error_path = work_dir / 'error.json'
    error_path.write_text(json.dumps(error_body), encoding='utf-8')
    put(env.result_put_url, error_path, 'application/json')


def main() -> int:
    try:
        env = load_job_env()
    except JobEnvError as e:
        # No RESULT_PUT_URL to report to — log and fail.
        print(f'fatal: {e}', file=sys.stderr)
        return 2

    with tempfile.TemporaryDirectory(prefix='climbiq-job-') as tmp:
        work_dir = Path(tmp)
        try:
            run_pipeline(env, work_dir)
        except StageError as e:
            print(f'pipeline failed at {e.stage}: {e}', file=sys.stderr)
            put_error(env, work_dir, e.stage, str(e))
            return 1
        except Exception as e:
            print(f'pipeline failed unexpectedly: {e}', file=sys.stderr)
            put_error(env, work_dir, 'unknown', str(e))
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
