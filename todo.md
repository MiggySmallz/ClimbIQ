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
- **M1 — Journal** (§12.2) — ✅ code complete; on-device verification pending. Climbs CRUD + stats (grade pyramid, sends-over-time).
- **M2 — Analysis container** (§12.3) — ✅ done. Full CV+LLM pipeline verified locally on real videos → schema-valid `result.json` + `overlay.mp4` + `timeline.json`.
- **M3 — Nosana plumbing** (§12.4) — 🔨 mostly built; **end-to-end loop owner-confirmed 2026-07-29** (phone → upload → Nosana → report). Mobile analyze flow (M3.13–M3.16b) code complete, device-verify. **Remaining: M3.10, M3.11, M3.17** ↓
- **M4 — Report UX** (§12.5) — ✅ code complete; on-device verification pending. Overlay player, issue cards + seek, two-way timeline, scores/grade, version fallback, expiry notice, climb-link, share visibility.
- **M5 — Progress + social** (§12.6) — ✅ code complete; on-device verification pending. Friendships, feed, technique trends, share visibility, pending-request badge. (M5.2b push-on-request half deferred to M3.17.)
- **M6 — Hardening** (§12.7) — 🔨 mostly built. Retention sweep, cost logging, Credits balance alert (M6.3, verified on device 2026-07-30 — correct balance + owner-only), account deletion, error-state polish all code complete (device-verify M6.4/M6.5).

---

## ▶ Remaining to build

### Blocked on Expo push credentials (owner)
- [ ] **M3.10** Expo push notifications: send on job done/failure (§7.2). Record job price when the SDK exposes it (§8.3).
- [ ] **M3.17** Push-token registration on app start / login (`POST /push/register` server half done in M3.9); notification tap deep-links to the report or retry screen. Also unblocks M5.2b's push-on-friend-request half.

### Blocked on deploy target (owner)
- [ ] **M3.11** Deploy orchestrator (Fly.io / Railway / VPS — single instance) (§7.2).

---

## On-device verification backlog (owner's phone — dev client required)

Code is complete for these; they need a physical-device pass. A dev client is installable (`expo run:android` / EAS `development` profile); Expo Go can't run the trim/camera native modules.

- **M1.2–M1.6** climbs list / add-edit form / delete / Home stats / empty-loading-error states
- **M3.13** camera-record → trim path (import → trim already verified)
- **M3.15** upload flow · **M3.16** job-status realtime screen · **M3.16b** analyze history list
- **M4.2–M4.9** report screen (overlay player, issue cards, timeline, scores, version fallback, expiry notice, climb-link, share visibility)
- **M5.2 / M5.2b** friend management + pending-request badge · **M5.3** feed · **M5.4** progress trends · **M5.5** friend-views-shared-report
- **M6.4** account deletion (needs a throwaway account) · **M6.5** error-state polish

---

## Owner-action checklist (only the owner can provide these)

- [x] Supabase project + Google OAuth credentials
- [x] Supabase service-role key in `backend/.env`
- [x] Cloudflare R2 account + bucket + keys in `backend/.env` (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`)
- [~] Nosana: `NOSANA_API_KEY` set. **Still needed: confirm Credits are funded + pick/set `NOSANA_MARKET`** (small GPU market, warm-node strategy §8.1).
- [ ] Expo push credentials (unblocks M3.10 / M3.17)
- [ ] Deploy target for the orchestrator (unblocks M3.11)
- [~] Apply pending migrations (`supabase db push` from `backend/`): **`20260724000001_analysis_jobs_one_active`** and **`20260729000001_realtime_friendships`** still pending.
- [x] Analysis image published: `docker.io/miggysmallz/climbiq-analysis-job:v1` (public). Set `ANALYSIS_IMAGE` to it; re-tag/re-push on any image change.
- [x] Sample climbing videos for M2 testing

**Local-dev env note (this machine):** port 8080 is taken by Oracle's TNS Listener — set `PORT=8787` in `backend/.env`, and set `mobile/.env` `EXPO_PUBLIC_API_URL` to `http://<machine-LAN-IP>:8787` (the LAN IP drifts on DHCP — re-check it, or use `adb reverse tcp:8787 tcp:8787` + `localhost` for a stable wired setup). Optional envs: `ANALYSIS_SAMPLE_FPS` (default 30), `OWNER_USER_ID` (unlocks `GET /admin/usage` + the Profile admin card), `NOSANA_CREDITS_ALERT_USD` (low-Credits threshold, default 5), `NOSANA_NODE` (pin a warm node). All env vars are documented in spec §13.
