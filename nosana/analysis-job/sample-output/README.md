# Sample report artifacts

A real, schema-valid output set from an M2.19 end-to-end pipeline run (real
Qwen LLM, one of the owner's test videos — the 27 s close-up climb).

- `result.json` — validates against `shared/src/report.schema.json`; 5 issues, 3 LLM-verified, real coaching text
- `overlay.mp4` — 404×720 H.264, 3 fps, skeleton overlay, duration matches `pipeline.duration_s`
- `timeline.json` — 80 points × 7 per-frame series (hip x/height, both elbow angles, both foot-axis angles)

**Use these to build the M4 report screen without R2 or any cloud accounts.**
Point the report screen at these local files for dev; swap in the real
`GET /reports/:id/artifacts` signed-URL endpoint (M4.1) once R2 exists.

Regenerate by running the analysis container on any climbing video — see the
run command in `../README.md`.
