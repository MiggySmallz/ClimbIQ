# ClimbIQ Nosana analysis job

Built in milestone M2 (see /todo.md and spec §8).

- `analysis-job/` — Dockerfile + Python pipeline (RTMW pose → features → rules → Qwen3.6-27B vision coaching), one GPU rental per video.
- `job-definition.json` — job template posted via `@nosana/kit`.
