# ClimbIQ — Build TODO

> **What this file is:** the list of things left to build, plus per-milestone status. **All product decisions, architecture, contracts, and rationale live in [CLIMBIQ_SPEC.md](CLIMBIQ_SPEC.md) — the single source of truth.** This file tracks *what's built and what's next*, never *what/why*.

> **Maintenance protocol (every session):**
> 1. Mark tasks `[x]` when done (batching is fine, but the file must be current before the session ends). Partial → `[~]` + a one-line `> what's left`.
> 2. New work → add it under the right milestone with the next free ID. **IDs are stable — never renumber or reuse them.**
> 3. Any product/design decision goes in `CLIMBIQ_SPEC.md`, not here. If reality diverges from the spec, fix the spec.
> 4. **Never assume when stuck or confused — ask the owner** before proceeding.

**Legend:** `[ ]` not started · `[~]` code complete, on-device verification pending · `[x]` done & verified

---

## Milestone status

- **M0 — Skeleton** (§12.1) — ✅ done. Monorepo, Supabase + migrations, Expo app with Google + email auth, profiles, CI. (M0.11 avatar flow verified on device 2026-07-30.)
- **M1 — Journal** (§12.2) — ✅ done. Climbs CRUD + stats (grade pyramid, sends-over-time). M1.2–M1.6 verified on device 2026-07-30.
- **M2 — Analysis container** (§12.3) — ✅ done. Full CV+LLM pipeline verified locally on real videos → schema-valid `result.json` + `overlay.mp4` + `timeline.json`.
- **M3 — Nosana plumbing** (§12.4) — 🔨 mobile + push fully device-verified 2026-07-31 (import/record→trim→upload→analysis→report, camera M3.18/trim M3.19, push M3.10/M3.17 all ✅). **Only remaining: M3.11** (deploy the orchestrator — owner picks host) ↓
- **M4 — Report UX** (§12.5) — ✅ done & fully device-verified. M4.2–M4.9 (2026-07-30) + climb-link "View analysis" button M4.10 (2026-07-31).
- **M5 — Progress + social** (§12.6) — ✅ done & fully device-verified. Friends/feed/shared-report (2026-07-30), pending-request badge M5.2b + technique trends M5.4 (2026-07-31). (M5.2b push-on-request half still open — infra ready via `PushData`, add `friend_request` type when wanted.)
- **M6 — Hardening** (§12.7) — ✅ done & fully device-verified. Retention sweep, cost logging, Credits alert (M6.3), account deletion (M6.4), error-state polish (M6.5, verified 2026-07-31).

---

## ▶ Remaining to build

### Push notifications — built + verified on device 2026-07-31 ✅
- [x] **M3.10** Send Expo push on job done/failure. Filled the `notify.ts` seam: fetches the recipient's `push_tokens`, POSTs to the Expo push API, prunes `DeviceNotRegistered` tokens; poller passes recipient user id. `backend/src/notify.ts`, `backend/src/poller.ts`, shared `PushData` type. Verified on device 2026-07-31. *(Still deferred: record job price when the Nosana SDK exposes it — §8.3.)*
- [x] **M3.17** Client push registration + tap deep-link. On sign-in acquires the Expo token (permission → channel → `getExpoPushTokenAsync`) and registers it; notification tap deep-links to the report (done) or `/analyze/status` retry screen (failure); handles cold-start taps. Added `expo-notifications`/`expo-device` + config plugin. `mobile/src/lib/push.ts`, `mobile/src/hooks/use-push-notifications.ts`, `_layout.tsx`, `app.json`. Verified on device 2026-07-31. *(Deep-link infra now supports adding M5.2b's `friend_request` push type later.)*

### Deploy — host chosen: Render.com (2026-07-31)
- [ ] **M3.11** Deploy the orchestrator to **Render.com** as a single **always-on** Web Service (§7.2). Plan:
  - **Pre-deploy code change:** move `tsx` from `devDependencies` → `dependencies` in `backend/package.json` (Render prunes dev deps in prod; `npm start` runs `tsx`). Add a `render.yaml` blueprint so it's reproducible.
  - **Render config:** Root Directory = **repo root** (so the `@climbiq/shared` npm workspace link resolves) · Build = `npm install` · Start = `npm start -w backend`. Render injects `PORT`; server already binds `0.0.0.0` + configurable port ✅.
  - **Tier:** paid **always-on** instance only (Starter ~$7/mo). Free/scale-to-zero sleeps after 15 min → the in-process 30 s poller stops → jobs freeze. **Single instance only** (poller not multi-instance safe — needs `FOR UPDATE SKIP LOCKED` first).
  - **Env vars (Render dashboard):** Supabase service-role, R2 keys, `NOSANA_API_KEY`, `NOSANA_MARKET`, `ANALYSIS_IMAGE`, `OWNER_USER_ID`, `NOSANA_CREDITS_ALERT_USD` (§13). No Expo/FCM secret on the backend — push sends via Expo's service.
  - **After deploy:** point `mobile/.env` `EXPO_PUBLIC_API_URL` at the Render URL + rebuild the app.

### Deferred (post-v1, not blocking)
- [ ] **M3.10a** Record Nosana job price on `analysis_jobs.cost_usd` per attempt once `@nosana/kit` exposes it (§8.3). The rest of M6.2 cost tracking is wired.
- [ ] **M5.2b-push** Friend-request push (deferred half of M5.2b): add a `friend_request` variant to the shared `PushData` type + send on request. Client deep-link infra already handles new `PushData` types.

### Fixes from 2026-07-30 device pass — verified on device 2026-07-31 ✅
- [x] **M3.18** Camera-record permission. First pass: detect `!canAskAgain` → open OS Settings. Follow-up: added AppState foreground re-check so returning from Settings auto-advances to the camera without a second tap, and clearer copy pointing at Settings ▸ Permissions ▸ Camera + Microphone. `record.tsx`. (Root cause of the "stuck" state: permission was hard-denied during earlier testing; a reinstall resets it so the in-app dialog returns.)
- [x] **M3.19** Trim-drag handles didn't move on device. Rebuilt as two dedicated per-handle PanResponders dragging by gesture delta (`dx`) with enlarged hitSlop, replacing the shared-track "grab nearest" approach; kept the side gutters so handles clear the OS edge-swipe zone. `trim-range.tsx`.
- [x] **M4.10** Climb-link reverse surfacing: climbs list shows a tappable **"View analysis ›"** button on climbs with a linked report, navigating to `/report/[id]` (latest report per climb). New `listClimbReportIds` service + realtime-refreshed `useClimbReportIds` hook. `climbs.tsx`, `use-climbs.ts`, `services/reports.ts`.

---

## On-device verification backlog (owner's phone — dev client required)

- ✅ **M1.2–M1.6** climbs list / add-edit / delete / Home stats — verified 2026-07-30
- ✅ **M3.15 / M3.16 / M3.16b** upload · realtime status · history — verified 2026-07-30 (full import→report path)
- ✅ **M4.2–M4.9** report screen (overlay, issue cards, timeline, scores, version fallback, expiry, climb-link, share) — verified 2026-07-30
- ✅ **M5.2 / M5.5** friend add · friend-views-shared-report + feed — verified 2026-07-30
- ✅ **M3.13** camera-record → trim — verified 2026-07-31 (after M3.18/M3.19 fixes)
- ✅ **M3.10 / M3.17** push notifications — verified 2026-07-31 (analysis finish → push received on device)
- ✅ **M5.2b** pending-request badge — verified 2026-07-31 (incoming request → Profile-tab + in-screen badge)
- ✅ **M5.4** technique-progress trends — verified 2026-07-31 (bottom of Home tab)
- ✅ **M6.5** error-state polish — verified 2026-07-31

**Backlog clear — every device-verify item passed. Only M3.11 (deploy) remains.**

---

## Owner-action checklist (only the owner can provide these)

- [x] Supabase project + Google OAuth credentials
- [x] Supabase service-role key in `backend/.env`
- [x] Cloudflare R2 account + bucket + keys in `backend/.env` (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`)
- [~] Nosana: `NOSANA_API_KEY` set. **Still needed: confirm Credits are funded + pick/set `NOSANA_MARKET`** (small GPU market, warm-node strategy §8.1).
- [x] Expo push credentials (M3.10/M3.17 built 2026-07-31):
  - [x] `google-services.json` — was at repo root; copied to `mobile/google-services.json` + `expo prebuild --clean` so Firebase is wired into `android/` (fixes "Default FirebaseApp is not initialized"). Rebuild dev client (`expo run:android`) to pick it up.
  - [x] **FCM V1 service account key** — confirmed already set up in Expo (`eas credentials`) 2026-07-31. Key is gitignored; never commit it or put it in `backend/.env`.
- [~] Deploy target for the orchestrator — **chosen: Render.com** (single always-on Web Service, ~$7/mo Starter). Build is M3.11 ↑.
- [~] Apply pending migrations (`supabase db push` from `backend/`): **`20260724000001_analysis_jobs_one_active`** and **`20260729000001_realtime_friendships`** still pending.
- [x] Analysis image published: `docker.io/miggysmallz/climbiq-analysis-job:v1` (public). Set `ANALYSIS_IMAGE` to it; re-tag/re-push on any image change.
- [x] Sample climbing videos for M2 testing

**Local-dev env note (this machine):** port 8080 is taken by Oracle's TNS Listener — set `PORT=8787` in `backend/.env`, and set `mobile/.env` `EXPO_PUBLIC_API_URL` to `http://<machine-LAN-IP>:8787` (the LAN IP drifts on DHCP — re-check it, or use `adb reverse tcp:8787 tcp:8787` + `localhost` for a stable wired setup). Optional envs: `ANALYSIS_SAMPLE_FPS` (default 30), `OWNER_USER_ID` (unlocks `GET /admin/usage` + the Profile admin card), `NOSANA_CREDITS_ALERT_USD` (low-Credits threshold, default 5), `NOSANA_NODE` (pin a warm node). All env vars are documented in spec §13.
