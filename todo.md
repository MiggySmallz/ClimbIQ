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

## M0 — Skeleton (§12.1)

**Goal:** monorepo + Supabase + Expo app with working auth. **Exit criteria:** a user can sign up (Google or email), set a username, and see an empty app shell. CI passes.

### M0.A — Repo & tooling
- [x] **M0.1** Initialize git repo + monorepo layout per §5: `/mobile`, `/backend` (with `/backend/supabase`), `/nosana/analysis-job`, `/nosana/job-definition.json`, `/shared`. Keep `CLIMBIQ_SPEC.md` and this `todo.md` at root.
- [x] **M0.2** Root `.gitignore` covering `.env*` everywhere, `node_modules`, Expo artifacts, Python caches. **Must be in the first commit** (§13).
- [~] **M0.3** TypeScript strict config for `/mobile`, `/backend`, `/shared`; shared lint config (eslint + prettier).
> STATUS: strict TS + prettier done everywhere; eslint currently mobile-only (`expo lint`). Backend/shared eslint added when service code lands (M3.1).
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
> STATUS: username flow implemented; optional avatar deferred (needs a Supabase Storage bucket for uploads) — add avatar picking during M0 wrap-up or with Profile polish.
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
- [ ] **M1.6** Empty/loading/error states verified on every list screen added so far.

---

## M2 — Analysis container (§12.3) ⚠️ HIGHEST RISK — do before any job plumbing

**Goal:** the full CV+LLM pipeline runs locally in Docker on a sample video and emits a valid `result.json`. **Exit criteria:** `docker run` with env-var contract (§8.1) on a sample climbing video produces `result.json` (schema-valid), `overlay.mp4`, `timeline.json`.

### M2.A — Contract first
- [x] **M2.1** `/shared`: report JSON contract — TS types + JSON Schema for `result.json` per §10 (`version`, `observations[]` with stable `key` enum / `severity` / `evidence` / `segments` / `verified` / `drill`, `positives`, `scores`, `grade_estimate`, `coaching_text`, `llm_model`, `pipeline`). Also define the structured **error JSON** shape for failed jobs (§8.1). (`shared/src/report.ts` + `report.schema.json`/`error.schema.json`; validated against fixtures via `shared/scripts/validate-schema.mjs` — 8/8 checks pass; spec §10 updated with the error contract.)
- [x] **M2.2** Define the initial `observations[].key` vocabulary (stable enum, additive-only per §10): e.g. `barn_door`, `hip_drop`, `bent_arm_hang`, `full_crimp_risk`, `poor_foot_contact`, + positives like `heel_hook`. Document each key's detection rule. (`shared/src/reportKeys.ts`, one-line detection rule per key; also recorded in spec §10.)

### M2.B — Container & pose
- [x] **M2.3** Dockerfile: CUDA runtime base, Python 3.11, **no PyTorch** (§8.1). rtmlib + `onnxruntime-gpu` + ffmpeg. Third-party model code = pinned dep or build-stage clone, never copied-in source (§3). (`nvidia/cuda:12.4.1-runtime-ubuntu22.04` + deadsnakes 3.11; onnxruntime-gpu 1.26 `[cuda,cudnn]`, rtmlib 0.0.15 pinned `--no-deps` to avoid the CPU-onnxruntime/opencv clobber; built + run verified locally with `--gpus all`: CUDAExecutionProvider available, all imports pass.)
- [ ] **M2.4** Bake ONNX models into image at build time: YOLOX person detector + RTMW wholebody 133-kpt (DWPose as documented fallback) (§8.1).
- [ ] **M2.5** Entrypoint reading env-var contract: `VIDEO_URL`, `RESULT_PUT_URL`, `OVERLAY_PUT_URL`, `TIMELINE_PUT_URL`, `JOB_PARAMS` (§8.1). For local dev, support `file://` or local-path equivalents behind the same interface.
- [ ] **M2.6** Streaming frame decode at ~3 fps sample rate — never buffer whole video in RAM (§3, §8.1). Models loaded once at startup; explicit concurrency cap.
- [ ] **M2.7** Person detection + tracking: YOLOX bbox per frame → track largest/most-central person → RTMW on tracked bbox (never full-frame) (§3, §8.1, §14.3).
- [ ] **M2.8** Temporal smoothing on keypoints: One-Euro or 5-frame median (§8.1).

### M2.C — Features, rules, scores
- [ ] **M2.9** Feature extraction from 2D keypoints (§8.1) — **all thresholds normalized to body scale (e.g. torso length in px), never absolute units; baselines from percentiles over a time window, never a single frame** (§3):
  - grip classification via PIP/DIP finger angles (crimp/open-hand/sloper)
  - full-crimp injury risk via DIP hyperextension
  - foot contact class via heel–toe axis angle (heel-hook/toe-hook/smear/edge)
  - elbow angles / bent-arm hang detection
  - barn-door via lateral hip travel
  - hip-drop vs baseline = 90th-percentile hip height over first 2 s of detected climbing (never frame 0)
- [ ] **M2.10** Rule-based issue detection → ranked issues with severity, evidence text, time segments. Rules decide *what* was detected; LLM never does (§3).
- [ ] **M2.11** Scores (per-category 0–100 + overall) + grade estimate: transparent heuristic from issue counts/severities, labeled "beta" (§8.1, §14.1).

### M2.D — LLM stage
- [ ] **M2.12** Bake Qwen3.6-27B GGUF Q4_K_M (~17 GB) + vision projector into image; serve via llama.cpp (§2, §8.1). Verify VRAM budget fits 24 GB: pose ONNX ~2 GB + Qwen ~17 GB + vision/KV overhead.
- [ ] **M2.13** Build `llm_context` (compact structured summary: duration, frames analyzed, ranked issues + evidence + timestamps, positives, grip distribution — never bulk keypoints) (§3).
- [ ] **M2.14** Evidence image extraction: per top issue, 3–5 bbox-cropped frames spanning the segment composed into one labeled strip/grid; + 2–3 whole-climb context frames; hard cap on total images for VRAM/token budget (§8.1).
- [ ] **M2.15** Coaching prompt template (versioned file in `/nosana/analysis-job`, §13): one Qwen call, temperature ~0.4, max ~800 tokens. Model returns per-issue `verified: true/false`, judgment additions (body-to-wall distance, dynamic vs static), `coaching_text`, per-issue `drill` strings (§8.1). Structured-output parsing + validation.
- [ ] **M2.16** Overlay clip render: skeleton on sampled frames → 720p H.264 via ffmpeg (§8.1).
- [ ] **M2.17** Timeline JSON artifact: per-frame series (hip height, elbow angles, etc.) for the biomechanics chart (§10 note: heavy per-frame data lives in R2).
- [ ] **M2.18** Assemble + PUT the three artifacts; exit 0. On any failure: PUT structured error JSON to `RESULT_PUT_URL`, exit non-zero (§8.1).
- [ ] **M2.19** End-to-end local validation: run container on ≥2 real climbing sample videos → `result.json` validates against `/shared` JSON Schema; visually sanity-check overlay + issue timestamps.

---

## M3 — Nosana plumbing (§12.4)

**Goal:** phone → upload → GPU job → report row → push notification, end to end.

### M3.A — Orchestrator service
- [ ] **M3.1** Scaffold Fastify TS service in `/backend`: env-only config (missing required secret fails startup loudly, §13), pino structured logs, Supabase JWT verification middleware on every route (§7.2). Never return stack traces/internal errors to clients (§3).
- [ ] **M3.2** Migration 0003: `videos` (+ `video_status` enum + indexes incl. partial on `expires_at`), `analysis_jobs` (+ `job_status` enum + indexes), `push_tokens` per §9. RLS: videos owner-only; `analysis_jobs` readable by video owner only (§7.1).
- [ ] **M3.3** R2 bucket + client: presigned PUT/GET generation. Key layout per §9: `videos/{user_id}/{video_id}.mp4`, `reports/{report_id}/{overlay.mp4,timeline.json,result.json}`. Sign `Content-Length` into presigned PUTs; ≤1 h expiry on job-facing URLs (§8.2 security). *(Requires owner: Cloudflare R2 account + bucket.)*
- [ ] **M3.4** `POST /videos`: validate metadata (duration ≤90 s, size caps), sanitize filename (§3), create `videos` row with `expires_at = created_at + 30 days`, return presigned PUT URL (§7.2).
- [ ] **M3.5** `POST /videos/:id/analyze`: create `analysis_jobs` row (`queued`) → post Nosana job → store `nosana_job_id`, status `posted` (§7.2).
- [ ] **M3.6** Nosana integration via `@nosana/kit` (SDK v2 — NOT legacy `@nosana/sdk`; Node ≥20.18): API-key + Credits auth (§8.2). One thin `postAnalysisJob()` module so wallet fallback touches one file. Job definition: `version`, `type: "container"`, one `container/run` op with `image`, `gpu: true`, `env` = presigned URLs + `JOB_PARAMS`. Pin one small GPU market (warm-node strategy, §8.1). **Never put R2/Supabase secrets in job definitions — env is public IPFS** (§8.2). *(Requires owner: Nosana dashboard API key + funded Credits.)*
- [ ] **M3.7** Job poller (`setInterval`, 30 s): poll non-terminal jobs → on success download `result.json` from R2 → validate against JSON Schema → insert `reports` row → mark `done` → push notification. On failure/timeout >20 min: mark `error`, auto-retry up to 2×, then user-visible failure push (§7.2, §8.3). Poller safe for single instance; use `FOR UPDATE SKIP LOCKED` pattern if ever scaled.
- [ ] **M3.8** Migration 0004: `reports` table (+ `report_visibility` enum + indexes) per §9. RLS: owner full access; friends SELECT where `visibility='friends'` via `friendships` join (friendships table lands in M5 — write the policy then or stub owner-only now and extend in M5; note which).
- [ ] **M3.9** `POST /jobs/:id/retry` (max 2 retries then `failed`) and `POST /push/register` (§7.2).
- [ ] **M3.10** Expo push notifications: send on job done/failure (§7.2). Record `posted_at`/`finished_at` + job price when SDK exposes it (§8.3).
- [ ] **M3.11** Deploy orchestrator (Fly.io / Railway / VPS — single instance) (§7.2).
- [ ] **M3.12** Publish analysis image to a registry Nosana nodes can pull; set image tag in orchestrator env (§13).

### M3.B — Mobile analyze flow (ships WITH the backend half, §3 ground rule)
- [ ] **M3.13** Analyze tab: record via expo-camera with framing-guidance overlay ("whole body + wall in frame…") **and** import via expo-image-picker (§6).
- [ ] **M3.14** Mandatory trim screen before every upload: pre-filled full range, one-tap confirm, coach copy "cut to pull-on → top-out". Pre-checks after trim: duration ≤90 s, resolution ≥720p. Compress to ≤1080p H.264 (§6).
- [ ] **M3.15** Upload flow: `POST /videos` → presigned PUT to R2 with progress bar → `POST /videos/:id/analyze`. For in-app recordings, offer "Save to device gallery" (expo-media-library) after upload (§6).
- [ ] **M3.16** Job status screen driven by Supabase realtime on `analysis_jobs.status` (queued → on GPU → analyzing → writing report); user can leave anytime (§6). Enable realtime on `analysis_jobs` + `reports` (§7.1). In-app copy: "first analyses can take longer" (cold-node pulls, §8.1).
- [ ] **M3.17** Push-token registration on app start / login (`POST /push/register`); notification tap deep-links to the report or retry screen.
- [ ] **M3.18** End-to-end test: film on phone → trimmed upload → Nosana job → push → report row exists. (Report *screen* is M4; verifying data arrival is enough here.)

---

## M4 — Report UX (§12.5)

**Goal:** the report screen renders the full §10 contract beautifully.

- [ ] **M4.1** `GET /reports/:id/artifacts` endpoint: short-lived signed GET URLs for overlay clip + timeline JSON (§7.2).
- [ ] **M4.2** Report screen: overlay clip player (expo-video) (§6).
- [ ] **M4.3** Issue cards: severity-colored, drill text, tap → seek video to evidence timestamp (§6).
- [ ] **M4.4** Biomechanics timeline chart synced **two-way** with the video scrubber (scrub chart ⇄ seek video) (§6).
- [ ] **M4.5** Score radar/bars + grade estimate labeled "beta" (§6, §14.1).
- [ ] **M4.6** Report `version` check: unknown version → graceful "update the app to view this report" fallback (§10).
- [ ] **M4.7** "Raw video available until <date>" expiry notice on report screen (§6).
- [ ] **M4.8** Link report to a journal climb (`reports.climb_id`, `videos.climb_id`) from the report screen (§11.6).
- [ ] **M4.9** Share button setting visibility private/friends (UI can land here; feed consumption is M5) (§6).

---

## M5 — Progress + social (§12.6)

**Goal:** technique trends, friendships, feed.

- [ ] **M5.1** Migration 0005: `friendships` table per §9 + finalize the friends-visibility RLS policy on `reports` (see M3.8).
- [ ] **M5.2** Friend management: search username → send request → accept (Profile/Feed) (§6).
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
- [ ] **M6.6** Security pass against §3 + §8.2: no secrets in job defs, filenames sanitized, no internal errors leaked, presigned URL scopes/expiries, `.env*` never committed.

---

## Cross-cutting rules (apply to EVERY task — from spec §3, non-negotiable)

- Backend capability + consuming app screen ship **together**, never one half alone.
- Commit small increments; HEAD always reflects real architecture.
- Update `CLIMBIQ_SPEC.md` whenever reality diverges from it — it is the only planning document.
- All backend types imported from `/shared` in the mobile app.
- Migrations-only schema changes, with indexes from the first table.
- No debug servers, no hardcoded secret fallbacks, sanitize uploads, never leak stack traces.

## Owner-action checklist (things only the project owner can provide — flag when a task hits one)

- [ ] Supabase project created + Google OAuth credentials (needed by M0.5)
- [ ] Cloudflare R2 account + bucket + keys (needed by M3.3)
- [ ] Nosana dashboard API key + Credits funded (needed by M3.6)
- [ ] Expo push credentials (needed by M3.10)
- [ ] Sample climbing videos for M2 testing (needed by M2.19)
- [ ] Container registry choice/credentials for the ~20 GB analysis image (needed by M3.12)

## Open questions (spec §14 — decide during build; defaults already given in spec)

1. Grade estimate calibration → ship "beta", collect owner-corrected grades.
2. VLM evidence tuning (frames per issue, strips vs clips, Q4 vs FP8) → contract unchanged while tuning.
3. Multiple climbers in frame → largest/most-central for v1; tap-to-select post-v1.
4. iOS / Apple sign-in → revisit at M5 (task M5.6).
5. Fine-tuning / annotation → out of scope for v1.
