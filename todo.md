# ClimbIQ — Build TODO

> **⚠️ MAINTENANCE PROTOCOL (READ FIRST, EVERY SESSION):**
> 1. **ALWAYS update this file when tasks are completed** — change `[ ]` to `[x]`. Batching several updates together is fine, but the list MUST be fully up to date before the session/work block ends. Never end a session with completed work unmarked.
> 2. If a task is partially done, mark it `[~]` and add a one-line `> STATUS:` note below it describing exactly what remains.
> 3. If reality diverges from a task (design change, blocked, obsolete), do NOT delete it — mark `[!]` with a `> NOTE:` explaining why, and update `CLIMBIQ_SPEC.md` too (the spec is the source of truth and must be kept current per §3).
> 4. New tasks discovered during work get added under the correct milestone with the next available ID (e.g. `M2.20`).
> 5. Task IDs are stable — never renumber or reuse them.
> 6. **NEVER make assumptions when stuck or confused.** If anything is ambiguous, underspecified, or contradictory — a spec gap, an unclear requirement, a choice the spec doesn't cover — STOP and ask the project owner to clarify before proceeding. Guessing wrong is more expensive than asking.

**Source of truth:** [CLIMBIQ_SPEC.md](CLIMBIQ_SPEC.md) — all product decisions are locked (spec §2). Do not re-litigate them. Section references below (§N) point into the spec.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked/changed

---

## ▶ NEXT UP (the account blockers are gone — CLOSE THE ANALYZE LOOP)

**Context for the next agent (as of 2026-07-20):** M0–M2 done. This session finished the previously-unblocked slate — **M4 report screen** (M4.2–M4.7, M4.9), **M3.6 Nosana job posting**, **M3.13/M3.14 analyze capture+trim/compress** (trim/compress device-verified on a dev client), and the **M6.6 static security pass** (clean). See each task's `> STATUS:` note.

**The big change: the owner-account blockers are now resolved.** R2 credentials confirmed available (account ID, access key ID, secret access key, bucket), `NOSANA_API_KEY` is in `backend/.env`, and the analysis image is **published to Docker Hub** (`docker.io/miggysmallz/climbiq-analysis-job:v1`, public). So the M3 cloud plumbing that was blocked is now buildable and *runnable*.

**FOCUS: build the phone→upload→GPU job→report loop, in this order.** Every screen it needs (M4 report, M3.13/M3.14 capture) already exists — this is the missing middle.

1. **M3.3 — R2 client.** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Endpoint `https://<account-id>.r2.cloudflarestorage.com`, region `auto`. Define these `backend/.env` vars (owner has the values): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — add to `loadConfig` REQUIRED + `.env.example`. Presigned PUT/GET, key layout §9 (`videos/{user_id}/{video_id}.mp4`, `reports/{report_id}/{overlay.mp4,timeline.json,result.json}`), sign `Content-Length` into PUTs, ≤1 h expiry on job-facing URLs (§8.2).
2. **M3.4 — `POST /videos`** (validate duration ≤90 s + size caps, sanitize filename §3, create `videos` row `expires_at=created_at+30d`, return presigned PUT) **+ M3.15 mobile upload** (the analyze "Clip ready" screen is the hook — replace its gated terminal state with: `POST /videos` → presigned PUT to R2 w/ progress → `POST /videos/:id/analyze`). Ship together (§3).
3. **M3.5 — `POST /videos/:id/analyze`.** Create `analysis_jobs` row (`queued`), presign the four job URLs (GET video + PUT result/overlay/timeline), call the **already-built** `createAnalysisJobPoster().postAnalysisJob()` (`backend/src/nosana/`), store `nosana_job_id`. **Before this can RUN:** set `ANALYSIS_IMAGE=docker.io/miggysmallz/climbiq-analysis-job:v1` and `NOSANA_MARKET` (owner still needs to pick a market) in `.env`; confirm Credits funded.
4. **M3.7 — poller** → validate `result.json` vs `/shared` schema → insert `reports` row (**set `version` from result.json — the column exists, added M4.6**) → push. Then **M4.1** (`GET /reports/:id/artifacts` signed URLs) + swap the dev shim in `mobile/src/services/reports.ts` (`getReport`/`getReportArtifacts`) to the real Supabase row + endpoint — the swap points are marked in that file.
5. **M3.16/M3.17** job-status realtime screen + push registration, then **M3.18** end-to-end test.

**Then M6 hardening** (retention sweep M6.1, cost logging M6.2, account deletion M6.4, error polish M6.5) and the **final M6.6 pass** over the new R2/Nosana code.

**Still owner-only (don't block on these unless the task needs them):** pick+set `NOSANA_MARKET` and confirm Nosana Credits; Expo push credentials (M3.10/M3.17); deploy target for the orchestrator (M3.11).

**Device-verification of `[~]` items** (M0.11, M1.2–M1.6, M5.2, M4 report render, M3.13 camera-record path) needs the owner's phone — a dev client is now installable (Expo Go can't run the trim/camera native modules). `expo run:android` (device/emulator) or an EAS dev build (`eas.json` `development` profile exists).

---

## M0 — Skeleton (§12.1)

**Goal:** monorepo + Supabase + Expo app with working auth. **Exit criteria:** a user can sign up (Google or email), set a username, and see an empty app shell. CI passes.

### M0.A — Repo & tooling
- [x] **M0.1** Initialize git repo + monorepo layout per §5: `/mobile`, `/backend` (with `/backend/supabase`), `/nosana/analysis-job`, `/nosana/job-definition.json`, `/shared`. Keep `CLIMBIQ_SPEC.md` and this `todo.md` at root.
- [x] **M0.2** Root `.gitignore` covering `.env*` everywhere, `node_modules`, Expo artifacts, Python caches. **Must be in the first commit** (§13).
- [x] **M0.3** TypeScript strict config for `/mobile`, `/backend`, `/shared`; shared lint config (eslint + prettier). (Completed 2026-07-13 with M3.1: root `eslint.config.mjs` (typescript-eslint flat config) covers backend+shared; mobile keeps `expo lint`.)
- [x] **M0.4** CI workflow: typecheck + lint on all TS packages + migration check (migrations apply cleanly to a fresh DB) (§12.1). (Pushed to `origin/main` 2026-07-13; typecheck/lint verified locally and migration-check replicated locally — both migrations apply cleanly to a fresh Postgres from zero.)

### M0.B — Supabase foundation
- [x] **M0.5** Create Supabase project; enable auth providers: Google + email/password (§7.1). (Project ref `yvikvvdwxvlpnhvudicy`, linked + migration pushed 2026-07-13.)
- [x] **M0.6** Migration 0001: `profiles` table per §9 schema, with RLS (owner full access on own row; all authenticated users can SELECT profiles for username search). (Applied to remote once M0.5 is done.)
- [x] **M0.7** Migrations live only in `backend/supabase/migrations/` — never dashboard-edited (§7.1). Document the `supabase db push`/reset workflow in `backend/README.md`.

### M0.C — Expo app shell + auth
- [x] **M0.8** Scaffold Expo app in `/mobile`: current Expo SDK (57), TypeScript strict, expo-router, tab navigator with 5 tabs: Home · Climbs · Analyze · Feed · Profile (§6). Tabs may be empty screens — but per §6 rules, no dead placeholder buttons inside them.
- [x] **M0.9** Install core deps: `@supabase/supabase-js`, TanStack Query; set up Supabase client + session persistence + auth context/hook.
- [x] **M0.10** Auth screens: Google sign-in button + email/password sign-up/sign-in via Supabase Auth (§6 Onboarding). (Verified on device 2026-07-13: email + Google both work; `auth/callback` deep-link route added for Android; dark-mode text fixed.)
- [~] **M0.11** First-login onboarding: username (required, unique) + optional avatar → writes `profiles` row.
> STATUS: username flow verified on device. Avatar implemented 2026-07-13: public `avatars` Storage bucket + owner-scoped storage RLS (migration 20260713000003, applied to remote), square-crop picker + 512px JPEG resize, upload in onboarding and change-photo on Profile tab. Needs device verification (bundle with M1.6 pass).
- [x] **M0.12** Services/hooks layer convention established: no business logic in screen components (§6 rules); `/shared` imported via workspace package.

---

## M1 — Journal (§12.2)

**Goal:** climbs CRUD + stats. **Exit criteria:** app is daily-usable as a climbing journal with zero AI features (§11.2).

- [x] **M1.1** Migration 0002: `climbs` table + indexes per §9, RLS owner-only. (Applied to remote 2026-07-13.)
- [~] **M1.2** Climbs tab: list screen (reverse-chron by `attempted_at`), with empty/loading/error states (§6 rules).
> STATUS: implemented (FlatList + pull-to-refresh + FAB); needs device verification.
- [~] **M1.3** Add/edit climb form: name, gym/location, grade (V-scale string), style, sent/attempt toggle, date, notes (§6 Climbs).
> STATUS: implemented as modal route `climb-form.tsx` (grade/style chips, native date picker); needs device verification.
- [~] **M1.4** Delete climb (confirm dialog).
> STATUS: implemented (delete button in edit form with confirm); needs device verification.
- [~] **M1.5** Stats screen (Home tab): grade pyramid + sends-over-time (last 6 months) with `react-native-gifted-charts`, plus sends/projects tiles. Journal-only stats; technique trends come in M5.
> STATUS: implemented on Home tab; needs device verification.
- [~] **M1.6** Empty/loading/error states verified on every list screen added so far.
> STATUS: code pass done 2026-07-13 — Climbs list, Home stats, and Friends all render explicit loading/error(+retry)/empty states; Feed is a static empty state until M5.3. Remaining: on-device verification together with M1.2–M1.5.

---

## M2 — Analysis container (§12.3) ⚠️ HIGHEST RISK — do before any job plumbing

**Goal:** the full CV+LLM pipeline runs locally in Docker on a sample video and emits a valid `result.json`. **Exit criteria:** `docker run` with env-var contract (§8.1) on a sample climbing video produces `result.json` (schema-valid), `overlay.mp4`, `timeline.json`.

### M2.A — Contract first
- [x] **M2.1** `/shared`: report JSON contract — TS types + JSON Schema for `result.json` per §10 (`version`, `observations[]` with stable `key` enum / `severity` / `evidence` / `segments` / `verified` / `drill`, `positives`, `scores`, `grade_estimate`, `coaching_text`, `llm_model`, `pipeline`). Also define the structured **error JSON** shape for failed jobs (§8.1). (`shared/src/report.ts` + `report.schema.json`/`error.schema.json`; validated against fixtures via `shared/scripts/validate-schema.mjs` — 8/8 checks pass; spec §10 updated with the error contract.)
- [x] **M2.2** Define the initial `observations[].key` vocabulary (stable enum, additive-only per §10): e.g. `barn_door`, `hip_drop`, `bent_arm_hang`, `full_crimp_risk`, `poor_foot_contact`, + positives like `heel_hook`. Document each key's detection rule. (`shared/src/reportKeys.ts`, one-line detection rule per key; also recorded in spec §10.)

### M2.B — Container & pose
- [x] **M2.3** Dockerfile: CUDA runtime base, Python 3.11, **no PyTorch** (§8.1). rtmlib + `onnxruntime-gpu` + ffmpeg. Third-party model code = pinned dep or build-stage clone, never copied-in source (§3). (`nvidia/cuda:12.4.1-runtime-ubuntu22.04` + deadsnakes 3.11; onnxruntime-gpu 1.26 `[cuda,cudnn]`, rtmlib 0.0.15 pinned `--no-deps` to avoid the CPU-onnxruntime/opencv clobber; built + run verified locally with `--gpus all`: CUDAExecutionProvider available, all imports pass.)
- [x] **M2.4** Bake ONNX models into image at build time: YOLOX person detector + RTMW wholebody 133-kpt (DWPose as documented fallback) (§8.1). (`scripts/bake_models.py` build stage → rtmlib cache; YOLOX-m 640×640 + RTMW-x-l 288×384, `Wholebody(mode='performance')`; runtime load verified with zero downloads; DWPose fallback documented in `nosana/analysis-job/README.md`. Image 6.84 GB pre-LLM.)
- [x] **M2.5** Entrypoint reading env-var contract: `VIDEO_URL`, `RESULT_PUT_URL`, `OVERLAY_PUT_URL`, `TIMELINE_PUT_URL`, `JOB_PARAMS` (§8.1). For local dev, support `file://` or local-path equivalents behind the same interface. (`src/job_env.py` + `src/artifacts.py` + `src/main.py`: stage-tagged errors → error JSON PUT + exit 1, missing env → exit 2; tested in-container with `file://` URLs; emitted error JSON validates against the shared schema.)
- [x] **M2.6** Streaming frame decode at ~3 fps sample rate — never buffer whole video in RAM (§3, §8.1). Models loaded once at startup; explicit concurrency cap. (`src/video_decode.py`: grab/retrieve stride sampler; models load once in `PoseEngine`; strictly sequential processing = concurrency cap 1.)
- [x] **M2.7** Person detection + tracking: YOLOX bbox per frame → track largest/most-central person → RTMW on tracked bbox (never full-frame) (§3, §8.1, §14.3). (`src/pose.py`: IoU-continuity tracker with largest/most-central fallback; RTMPose called with exactly the tracked bbox. Verified on all 3 owner test videos — 100% person detection, skeleton visually correct incl. finger keypoints on holds; ~50 ms/frame at 1080p on GPU after switching base image to `cudnn-runtime` so ORT's CUDA provider finds libcudnn.)
- [x] **M2.8** Temporal smoothing on keypoints: One-Euro or 5-frame median (§8.1). (5-frame centered median over detected frames in `pose.smooth_keypoints`; undetected frames pass through.)

### M2.C — Features, rules, scores
- [x] **M2.9** Feature extraction from 2D keypoints (§8.1) — **all thresholds normalized to body scale (e.g. torso length in px), never absolute units; baselines from percentiles over a time window, never a single frame** (§3):
  - grip classification via PIP/DIP finger angles (crimp/open-hand/sloper)
  - full-crimp injury risk via DIP hyperextension
  - foot contact class via heel–toe axis angle (heel-hook/toe-hook/smear/edge)
  - elbow angles / bent-arm hang detection
  - barn-door via lateral hip travel
  - hip-drop vs baseline = 90th-percentile hip height over first 2 s of detected climbing (never frame 0)
> STATUS: `src/features.py` — per-frame features + 2s-window hip baseline, output sanity-verified on all 3 test videos. Owner decision 2026-07-13 (recorded in spec §8.1): hand/finger features are **secondary** — gated at 0.5 kp-confidence with all finger joints required, ranked below body-level features; sloper class dropped for v1 (2D projection can't see it reliably). Barn-door here = per-frame hip x only; the short-window oscillation rule lands in M2.10 (test video 1 is a traverse — total lateral travel is NOT the signal). Thresholds are named constants, beta — tune in M2.19.
- [x] **M2.10** Rule-based issue detection → ranked issues with severity, evidence text, time segments. Rules decide *what* was detected; LLM never does (§3).
> STATUS: `src/rules.py` — all 5 issue keys + heel_hook positive; barn-door = short-window out-and-back excursion (traverse video correctly yields none); ranking = severity, then body-level before hand-derived, then time affected. Verified on all 3 test videos. Known tuning item for M2.19: `poor_foot_contact` (TOE_UP_DEG=35°) likely over-triggers on profile-view feet — fired high on all 3 videos.
- [x] **M2.11** Scores (per-category 0–100 + overall) + grade estimate: transparent heuristic from issue counts/severities, labeled "beta" (§8.1, §14.1).
> STATUS: `src/scoring.py` — per-category penalties by severity; overall weights grip at 0.1 (owner de-emphasis). Grade estimate v1 anchors on declared_grade or abstains (technique features can't derive route grade); LLM stage may refine (M2.15), calibration stays §14.1's open question.

### M2.D — LLM stage
- [x] **M2.12** Bake Qwen3.6-27B GGUF Q4_K_M (~17 GB) + vision projector into image; serve via llama.cpp (§2, §8.1). Verify VRAM budget fits 24 GB: pose ONNX ~2 GB + Qwen ~17 GB + vision/KV overhead.
> STATUS: Resumed after the 2026-07-13 WSL/Docker crash (see git history) — llama.cpp `b9987` built with `-j 4` (unbounded `-j` OOM'd the WSL VM twice; capped and commented in the Dockerfile). Full image 23.3 GB. VRAM verified on owner's 3090: idle-loaded 19.6/24.6 GB, peak 19.7/24.6 GB under a realistic 5-image evidence request — comfortable headroom. Pose ONNX sessions are freed before the LLM starts, so peak VRAM is pose OR llm, never both concurrently.
- [x] **M2.13** Build `llm_context` (compact structured summary: duration, frames analyzed, ranked issues + evidence + timestamps, positives, grip distribution — never bulk keypoints) (§3). (`src/llm_context.py` — ~1 KB JSON verified on test video.)
- [x] **M2.14** Evidence image extraction: per top issue, 3–5 bbox-cropped frames spanning the segment composed into one labeled strip/grid; + 2–3 whole-climb context frames; hard cap on total images for VRAM/token budget (§8.1). (`src/evidence.py` — 3 strips × 4 tiles + 2 context frames = hard cap 5 images, one streaming decode pass; labeled strips visually verified.)
- [x] **M2.15** Coaching prompt template (versioned file in `/nosana/analysis-job`, §13): one Qwen call, temperature ~0.4, max ~800 tokens. Model returns per-issue `verified: true/false`, judgment additions (body-to-wall distance, dynamic vs static), `coaching_text`, per-issue `drill` strings (§8.1). Structured-output parsing + validation.
> STATUS: `prompts/coaching_v1.md` + `src/llm.py`. Tested against the real model (M2.12) — found and fixed two real bugs: (1) Qwen3.6 is hybrid-thinking and silently burned the whole `max_tokens` budget on `reasoning_content`, returning empty `content` (`finish_reason=length`) — fixed by sending `chat_template_kwargs: {enable_thinking: false}`, confirmed via the model's own Jinja chat template. (2) despite `response_format: json_object`, output still arrives wrapped in a ` ```json ` fence — `_parse_output` now strips a leading/trailing fence before `json.loads`. Verified end-to-end on 2 real videos (see M2.19): 3/5 and 2/2 issues correctly verified, coherent coaching text, all issue keys present. `SKIP_LLM=1` dev path still available for pipeline-only iteration.
- [x] **M2.16** Overlay clip render: skeleton on sampled frames → 720p H.264 via ffmpeg (§8.1). (`src/overlay.py` — frames streamed into ffmpeg stdin at sample_fps real-time pacing so clip time == climb time for issue-card seeks; verified 56 s / 169-frame clip, skeleton visually correct.)
- [x] **M2.17** Timeline JSON artifact: per-frame series (hip height, elbow angles, etc.) for the biomechanics chart (§10 note: heavy per-frame data lives in R2). (`src/timeline.py` — body-scale-normalized series + hip baseline, ~7 KB for a 56 s climb.)
- [x] **M2.18** Assemble + PUT the three artifacts; exit 0. On any failure: PUT structured error JSON to `RESULT_PUT_URL`, exit non-zero (§8.1). (`assemble_result` in `src/main.py`; verified end-to-end with SKIP_LLM=1 — result.json validates against the shared report schema, all three artifacts PUT; error path verified earlier in M2.5.)
- [x] **M2.19** End-to-end local validation: run container on ≥2 real climbing sample videos → `result.json` validates against `/shared` JSON Schema; visually sanity-check overlay + issue timestamps.
> STATUS: ran full pipeline (real LLM, no SKIP_LLM) on 2 of the owner's 3 test videos. Both `result.json` outputs validate against `report.schema.json` (ajv). Video 1 (close-up, 27s): 5 issues detected, 3 LLM-verified, overlay 404×720 h264 @3fps matching `pipeline.duration_s`, timeline 80 points × 7 series. Video 2 (distant traverse, 56s): 2 issues, 2 verified, correctly found *no* barn-door (lateral traverse, not out-and-back — matches the M2.9 status note). Third video (`video3.mp4`) not yet run — optional, exit criteria (≥2 videos) already met.

---

## M3 — Nosana plumbing (§12.4)

**Goal:** phone → upload → GPU job → report row → push notification, end to end.

### M3.A — Orchestrator service
- [x] **M3.1** Scaffold Fastify TS service in `/backend`: env-only config (missing required secret fails startup loudly, §13), pino structured logs, Supabase JWT verification middleware on every route (§7.2). Never return stack traces/internal errors to clients (§3). (Done 2026-07-13: `src/config.ts`/`server.ts`/`plugins/auth.ts`; JWT verified via `auth.getUser` — swap to local JWKS if latency ever matters; generic 5xx bodies; `GET /health` public + `GET /me` authenticated; smoke-tested: missing env fails startup, /health 200, /me 401 without/with bad token. Later same day, with the owner-provided service-role key: verified end-to-end — admin-created test user's real JWT → /me 200 with matching user id, test user deleted after.)
- [x] **M3.2** Migration 0003: `videos` (+ `video_status` enum + indexes incl. partial on `expires_at`), `analysis_jobs` (+ `job_status` enum + indexes), `push_tokens` per §9. RLS: videos owner-only; `analysis_jobs` readable by video owner only (§7.1). (Migration `20260713000004` applied to remote 2026-07-13; owner writes limited to `videos` UPDATE (climb re-link, M4.8) — inserts/status changes are orchestrator-only via service role; shared row types added to `shared/src/db.ts`.)
- [ ] **M3.3** R2 bucket + client: presigned PUT/GET generation. Key layout per §9: `videos/{user_id}/{video_id}.mp4`, `reports/{report_id}/{overlay.mp4,timeline.json,result.json}`. Sign `Content-Length` into presigned PUTs; ≤1 h expiry on job-facing URLs (§8.2 security). *(Requires owner: Cloudflare R2 account + bucket.)*
- [ ] **M3.4** `POST /videos`: validate metadata (duration ≤90 s, size caps), sanitize filename (§3), create `videos` row with `expires_at = created_at + 30 days`, return presigned PUT URL (§7.2).
- [ ] **M3.5** `POST /videos/:id/analyze`: create `analysis_jobs` row (`queued`) → post Nosana job → store `nosana_job_id`, status `posted` (§7.2).
- [~] **M3.6** Nosana integration via `@nosana/kit` (SDK v2 — NOT legacy `@nosana/sdk`; Node ≥20.18): API-key + Credits auth (§8.2). One thin `postAnalysisJob()` module so wallet fallback touches one file. Job definition: `version`, `type: "container"`, one `container/run` op with `image`, `gpu: true`, `env` = presigned URLs + `JOB_PARAMS`. Pin one small GPU market (warm-node strategy, §8.1). **Never put R2/Supabase secrets in job definitions — env is public IPFS** (§8.2). *(Requires owner: Nosana dashboard API key + funded Credits.)*
> STATUS: code done 2026-07-20 (`@nosana/kit@^2.7.0` added to backend). `src/nosana/jobDefinition.ts` — pure builder producing `version:"0.1"`/`type:"container"`/one `container/run` op (`gpu:true`, image, env = the four presigned URLs + `JOB_PARAMS` JSON whose keys match the container's `job_env.py`: `video_id`/`sample_fps`/`declared_grade`); `assertNoSecretsInEnv` tripwire rejects any non-contract/secret-looking env key. `src/nosana/postAnalysisJob.ts` — the thin one-file abstraction: creates the client via API-key/Credits (`createNosanaClient(MAINNET,{api:{apiKey}})`), validates the def (`validateJobDefinition`), pins to IPFS, then `client.api.jobs.list({ipfsHash,market,timeout})`; returns `{jobId,runId,market,ipfsHash,costUsd}` (Nosana "list" = post-to-market; `list` response `job`/`run`/`credits.costUSD`). Config: `loadNosanaConfig()` (separate from core config so the server still boots without Credits; fails loud when the poster is built) reads `NOSANA_API_KEY`/`NOSANA_MARKET`/`ANALYSIS_IMAGE` (+ optional timeout/fps), documented in `.env.example`. Unit test `jobDefinition.test.ts` (5 cases incl. the built def passing Nosana's own `validateJobDefinition` schema) — new `npm test` script (root + backend) wired into CI. **Cannot be run** until the owner funds Credits + provides the API key/market, and M3.12 publishes the image; wiring into `POST /analyze` is M3.5 (blocked on R2 presigned URLs).
- [ ] **M3.7** Job poller (`setInterval`, 30 s): poll non-terminal jobs → on success download `result.json` from R2 → validate against JSON Schema → insert `reports` row (**set `version` from result.json's `version` — added for M4.6**) → mark `done` → push notification. On failure/timeout >20 min: mark `error`, auto-retry up to 2×, then user-visible failure push (§7.2, §8.3). Poller safe for single instance; use `FOR UPDATE SKIP LOCKED` pattern if ever scaled.
- [x] **M3.8** Migration 0004: `reports` table (+ `report_visibility` enum + indexes) per §9. RLS: owner full access; friends SELECT where `visibility='friends'` via `friendships` join (friendships table lands in M5 — write the policy then or stub owner-only now and extend in M5; note which). (Done 2026-07-13, migration `20260713000005` applied to remote: owner-all policy. The friends SELECT policy landed the same day in the friendships migration — M5.1 was pulled forward — so no stub remains. `ReportRow` type added to `/shared`.)
- [ ] **M3.9** `POST /jobs/:id/retry` (max 2 retries then `failed`) and `POST /push/register` (§7.2).
- [ ] **M3.10** Expo push notifications: send on job done/failure (§7.2). Record `posted_at`/`finished_at` + job price when SDK exposes it (§8.3).
- [ ] **M3.11** Deploy orchestrator (Fly.io / Railway / VPS — single instance) (§7.2).
- [~] **M3.12** Publish analysis image to a registry Nosana nodes can pull; set image tag in orchestrator env (§13).
> STATUS: 2026-07-20 — image `climbiq-analysis-job:test` (23.3 GB, the M2.19-verified build) tagged `miggysmallz/climbiq-analysis-job:v1` and **pushed to Docker Hub (public)**. Security-audited before push and **clean** (no `.env`/tokens/keys in build context; `bake_models.py` uses no auth; only GGUF weights in `models/`; no hardcoded secrets in `src`/`prompts`/`scripts`; baked ENV is CUDA/Python/model-path only; image-filesystem scan found no HF/AWS/`.netrc`/git/docker creds — matches §8.2: secrets arrive at runtime via presigned URLs, never baked). **Remaining:** set `ANALYSIS_IMAGE=docker.io/miggysmallz/climbiq-analysis-job:v1` in `backend/.env` once the push finishes; confirm the Docker Hub repo shows **Public** (Settings → Visibility) so Nosana nodes can pull anonymously. Re-tag/re-push (`:v2`, …) on any image change — Nosana pins by exact tag.

### M3.B — Mobile analyze flow (ships WITH the backend half, §3 ground rule)
- [~] **M3.13** Analyze tab: record via expo-camera with framing-guidance overlay ("whole body + wall in frame…") **and** import via expo-image-picker (§6).
> STATUS: implemented 2026-07-20. `(tabs)/analyze.tsx` = record/import entry with framing coach copy; `analyze/record.tsx` = full-screen `expo-camera` `CameraView` (mode="video"), dashed body-framing guide, tap-to-record with elapsed/max timer, camera+mic permission gates, `maxDuration` = 90 s → hands the recording to the trim screen. `expo-camera@~57.0.3` added + config plugin (camera/mic permissions) in app.json. **Partially verified on device 2026-07-20** — the import → trim path works end to end. Still to confirm on device: the **camera-record** path (record → trim) on a physical phone (emulator has only a virtual camera).
- [~] **M3.14** Mandatory trim screen before every upload: pre-filled full range, one-tap confirm, coach copy "cut to pull-on → top-out". Pre-checks after trim: duration ≤90 s, resolution ≥720p. Compress to ≤1080p H.264 (§6).
> STATUS: implemented 2026-07-20. `analyze/trim.tsx` + `components/trim-range.tsx` (thumbnail strip via `getFrameAt` + two-handle draggable range, pre-filled full range, live duration readout) + `services/video.ts` (all logic per §6: pick/probe/thumbnails/preCheck/processClip). Confirm runs pre-checks (≤90 s; ≥720p via a frame-probe when dims are unknown) then real trim + ≤1080p-short-side compress (no upscale). **Library decision (owner 2026-07-20, then corrected):** owner picked react-native-compressor, but it only compresses — can't trim. Substituted **`react-native-video-trim@^8.2.1`** which does headless `trim()` + `compress()` + `getFrameAt()` in one maintained native module using native hardware re-encoding (not the retired ffmpeg-kit); recorded in spec §6. Terminal state is honest: the clip is trimmed+compressed locally and previewed, with copy that upload/analysis turn on with M3.15 (blocked on R2) — no fake "analyzing". **VERIFIED on device 2026-07-20** (dev client over `--tunnel`): import → trim → real trim+compress executed → landed on the M3.15-gated "Clip ready" state. Also added during verification: lazy-load of the native module + `isVideoProcessingSupported` (Expo Go shows a "needs a dev build" state instead of a `VideoTrim` invariant).
- [ ] **M3.15** Upload flow: `POST /videos` → presigned PUT to R2 with progress bar → `POST /videos/:id/analyze`. For in-app recordings, offer "Save to device gallery" (expo-media-library) after upload (§6).
- [ ] **M3.16** Job status screen driven by Supabase realtime on `analysis_jobs.status` (queued → on GPU → analyzing → writing report); user can leave anytime (§6). Enable realtime on `analysis_jobs` + `reports` (§7.1). In-app copy: "first analyses can take longer" (cold-node pulls, §8.1).
- [ ] **M3.17** Push-token registration on app start / login (`POST /push/register`); notification tap deep-links to the report or retry screen.
- [ ] **M3.18** End-to-end test: film on phone → trimmed upload → Nosana job → push → report row exists. (Report *screen* is M4; verifying data arrival is enough here.)

---

## M4 — Report UX (§12.5)

**Goal:** the report screen renders the full §10 contract beautifully.

> ▶ NEXT: this whole milestone (except M4.1) is buildable **without accounts** — real fixture artifacts are in `nosana/analysis-job/sample-output/`. Build M4.2–M4.7 + M4.9 against those local files; on-device rendering verification is the owner's (mark `[~]`). M4.1 + M4.8-backend need R2/routes → leave for when M3 unblocks.

- [~] **M4.1** `GET /reports/:id/artifacts` endpoint: short-lived signed GET URLs for overlay clip + timeline JSON (§7.2).
> STATUS: endpoint still BLOCKED on R2 (M3.3). The client-side dev shim landed 2026-07-20 — `mobile/src/services/reports.ts` `getReportArtifacts()` loads the bundled sample (`mobile/src/dev/sample-report/{result,timeline}.json` + `overlay.mp4`) for the `'sample'` report id, and throws `report_artifacts_unavailable` for real ids until this endpoint exists. The swap is confined to that one function. `getReport()` similarly returns a fixture-derived `ReportRow` for `'sample'` and already has the real Supabase query (with a `videos(expires_at,status)` join for the M4.7 notice) for real ids.
- [~] **M4.2** Report screen: overlay clip player (expo-video) (§6).
> STATUS: implemented 2026-07-20 — route `report/[id].tsx` (registered in `_layout.tsx`), `expo-video` (`useVideoPlayer`/`VideoView`, native controls) added as a dep (`~57.0.1`). Reached in dev via a `__DEV__`-gated "View sample report" button on the Profile tab (`/report/sample`). Needs device verification. **Owner:** rebuild the native dev client — `expo-video` is a native module (`npx expo install expo-video` already reflected in package.json; run prebuild/dev-client build).
- [~] **M4.3** Issue cards: severity-colored, drill text, tap → seek video to evidence timestamp (§6).
> STATUS: implemented 2026-07-20 — severity stripe/badge (`lib/report-copy.ts`), evidence, per-segment play chips that seek the video to `start_s`, drill text (hidden when `drill === 'N/A'`). LLM-unverified observations are split into a muted "Checked, not a problem here" section instead of shown as advice. Needs device verification.
- [~] **M4.4** Biomechanics timeline chart synced **two-way** with the video scrubber (scrub chart ⇄ seek video) (§6).
> STATUS: implemented 2026-07-20 — `components/biomech-chart.tsx` (react-native-svg + PanResponder). Series selector (hip height/lateral, L/R elbow), cursor tracks video `currentTime`, dragging the plot seeks the video; hip-height shows the baseline reference line. New `Timeline`/`TimelineSeries` types added to `/shared`. Needs device verification.
- [~] **M4.5** Score radar/bars + grade estimate labeled "beta" (§6, §14.1).
> STATUS: implemented 2026-07-20 — big overall score + per-category bars (red/amber/green by value), grade estimate with a "beta" tag, and a "scores + grade are beta" footer. Needs device verification.
- [~] **M4.6** Report `version` check: unknown version → graceful "update the app to view this report" fallback (§10).
> STATUS: implemented 2026-07-20. Client checks `report.version` against `SUPPORTED_REPORT_VERSION=1`. **Schema change:** the client reads the report *row* (not result.json), which had no version — added `version smallint not null default 1` to `reports` (migration `20260720000001_reports_version.sql`, `ReportRow.version` in `/shared`, spec §9). **M3.7 must set it from result.json's `version` on insert.** Needs device verification (of the fallback render).
- [~] **M4.7** "Raw video available until <date>" expiry notice on report screen (§6).
> STATUS: implemented 2026-07-20 — notice shows the video's `expires_at` (from the `videos` join; sample synthesizes now+30d), or "raw video has expired" when null. Needs device verification.
- [ ] **M4.8** Link report to a journal climb (`reports.climb_id`, `videos.climb_id`) from the report screen (§11.6).
> DEFERRED: needs the report to exist as a real row + backend write path (R2/M3). Left for when M3 unblocks, per the NEXT-UP note.
- [~] **M4.9** Share button setting visibility private/friends (UI can land here; feed consumption is M5) (§6).
> STATUS: implemented 2026-07-20 — Private/Friends segmented control writing `reports.visibility` via `useSetReportVisibility` (owner-all RLS permits it); for the sample id it updates the query cache locally (no row). Needs device verification.

---

## M5 — Progress + social (§12.6)

**Goal:** technique trends, friendships, feed.

- [x] **M5.1** Migration 0005: `friendships` table per §9 + finalize the friends-visibility RLS policy on `reports` (see M3.8). (Pulled forward to 2026-07-13 — friend management needs no external keys, unlike the R2/Nosana-blocked M3 work. Migration `20260713000006` applied to remote: friendships + unique least/greatest pair index (no duplicate/reverse requests, added to spec §9) + friends SELECT policy on reports. Accept is addressee-only and column-restricted (`grant update (status)`) so an update can't rewrite the pair. `Friendship` type in `/shared`.)
- [~] **M5.2** Friend management: search username → send request → accept (Profile/Feed) (§6).
> STATUS: implemented 2026-07-13 (pulled forward with M5.1): `/friends` screen (username search → Add/Accept/Requested states, Requests/Sent/Friends sections, decline/cancel/unfriend with confirm), reached from Profile "Friends" button and Feed "Find friends" CTA; services/hooks layered per §6 rules. Needs device verification.
- [ ] **M5.3** Feed tab: reverse-chron friends' shared reports (thumbnail, grade, top issue, score) → tap → read-only report view (§6). Realtime on `reports` inserts (§7.1).
- [ ] **M5.4** Progress screen: per-issue trend lines aggregated from `reports.observations` only — never raw video (e.g. "barn-door frames per climb, last 10 reports") (§6, §2 retention).
- [ ] **M5.5** Verify a friend can view a shared report end-to-end (RLS + signed artifact URLs for non-owner viewers).
- [ ] **M5.6** Revisit iOS/Apple sign-in question (§14.4) — decide and record in spec.

---

## M6 — Hardening (§12.7)

- [ ] **M6.1** Retention sweep (daily loop in orchestrator): delete R2 originals where `videos.expires_at < now()`, set `status='expired'`. Report artifacts never deleted (§7.2, §11.8).
- [ ] **M6.2** Cost logging: per-job price + duration in `analysis_jobs`; simple owner-visible summary (§8.3).
- [ ] **M6.3** Nosana Credits balance alert via `client.api.credits` (§12.7).
- [ ] **M6.4** Account deletion: cascade-delete DB rows + R2 sweep of the user's keys (§11.9); settings entry in Profile (§6).
- [ ] **M6.5** Error-state polish pass: every screen's empty/loading/error states, failure pushes ("Analysis failed — tap to retry"), retry UX (§8.3, §12.7).
- [~] **M6.6** Security pass against §3 + §8.2: no secrets in job defs, filenames sanitized, no internal errors leaked, presigned URL scopes/expiries, `.env*` never committed.
> STATUS: static pass over existing backend + job code done 2026-07-20 — **clean**. Verified: (1) no secrets in job defs — `jobDefinition.assertNoSecretsInEnv` allow-lists exactly the 5 contract env keys and rejects secret-looking/unexpected keys (also blocks debug-env injection like `DEBUG_POSE_DUMP_DIR`); job env carries only presigned URLs + non-secret `JOB_PARAMS`. (2) No internal errors leaked — `server.setErrorHandler` returns generic `"internal error"` for ≥500, message only for <500; auth is secure-by-default (JWT required unless a route sets `config.public`, only `/health`); service-role key never leaves the process. (3) `.env*` never committed — only `*.env.example` tracked; `.env`/`.env.*` ignored; `backend/.env`+`mobile/.env` confirmed ignored; no hardcoded secrets in tracked source; mobile uses the public anon key via env with loud-fail. (4) RLS enabled on all 7 tables, each with policies. (5) Job writes fixed tempdir paths (no user-controlled filenames); `artifacts.py` streams (never buffers), sets `Content-Length`, intercepts `file://` before `urlopen`. **Forward items for the final pass (when M3.3/M3.4/M3.7 land the R2+orchestrator routes):** sanitize uploaded filenames in `POST /videos` (§3); presigned URLs single-object + ≤1 h expiry with signed `Content-Length` (§8.2, M3.3); the orchestrator must NOT forward the job error-JSON `message` to clients verbatim (§10) — note the download-stage message can embed the (already IPFS-public, ephemeral) presigned URL, so treat `message` as log-only; keep any future 4xx error messages client-safe.

---

## Cross-cutting rules (apply to EVERY task — from spec §3, non-negotiable)

- Backend capability + consuming app screen ship **together**, never one half alone.
- Commit small increments; HEAD always reflects real architecture.
- Update `CLIMBIQ_SPEC.md` whenever reality diverges from it — it is the only planning document.
- All backend types imported from `/shared` in the mobile app.
- Migrations-only schema changes, with indexes from the first table.
- No debug servers, no hardcoded secret fallbacks, sanitize uploads, never leak stack traces.

## Owner-action checklist (things only the project owner can provide — flag when a task hits one)

- [x] Supabase project created + Google OAuth credentials (needed by M0.5)
- [x] Supabase service-role key copied into `backend/.env` (dashboard → Settings → API; needed to run the orchestrator, M3.4+)
- [x] Cloudflare R2 account + bucket + keys (needed by M3.3) — owner confirmed 2026-07-20 they have all four: **account ID**, **access key ID**, **secret access key**, **bucket name**. Not yet in `backend/.env` under final var names — M3.3 defines them (see NEXT-UP note).
- [~] Nosana dashboard API key + Credits funded (needed by M3.6) — `NOSANA_API_KEY` added to `backend/.env` 2026-07-20. **Still needed:** confirm Credits are funded, and pick + set `NOSANA_MARKET` (a small GPU market address via `client.api.markets`, warm-node strategy §8.1).
- [ ] Expo push credentials (needed by M3.10)
- [x] Sample climbing videos for M2 testing (needed by M2.19)
- [x] Container registry choice/credentials for the ~20 GB analysis image (needed by M3.12) — Docker Hub `miggysmallz`, image pushed as `docker.io/miggysmallz/climbiq-analysis-job:v1` (public).

## Open questions (spec §14 — decide during build; defaults already given in spec)

1. Grade estimate calibration → ship "beta", collect owner-corrected grades.
2. VLM evidence tuning (frames per issue, strips vs clips, Q4 vs FP8) → contract unchanged while tuning.
3. Multiple climbers in frame → largest/most-central for v1; tap-to-select post-v1.
4. iOS / Apple sign-in → revisit at M5 (task M5.6).
5. Fine-tuning / annotation → out of scope for v1.
