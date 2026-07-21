# ClimbIQ backend

Orchestrator service (Fastify) — presigned R2 URLs, Nosana job posting/polling,
report ingestion, push notifications (spec §7.2). Also holds the Supabase
configuration and SQL migrations.

## Running the orchestrator

```sh
cp .env.example .env   # fill in SUPABASE_SERVICE_ROLE_KEY (dashboard → Settings → API)
npm run dev            # tsx watch, from /backend
```

Every route requires a Supabase user JWT (`Authorization: Bearer <access_token>`)
except `GET /health`. `GET /me` echoes the authenticated user id — handy for
checking a token. Config is env-only; missing required vars fail startup.

## Supabase migration workflow (spec §7.1 — read before touching the schema)

Schema is managed **exclusively** through SQL files in `supabase/migrations/` —
never hand-edit tables in the Supabase dashboard.

- File naming: `YYYYMMDDHHMMSS_short_name.sql` (sortable timestamp prefix).
- Every table ships with RLS enabled + policies and its indexes in the same migration.

### Commands (Supabase CLI)

The CLI ships as a repo dev dependency — no global install. Run it via `npx`
(from this `backend/` dir, where `supabase/config.toml` lives) or the npm
scripts below:

```sh
npx supabase login                    # once (per machine)
npx supabase link --project-ref <ref> # once per machine, ref from dashboard URL

npm run db:push                # apply pending local migrations to the remote DB
npm run db:reset               # local dev DB only: recreate from all migrations
npm run db:new -- <name>       # scaffold a new timestamped migration file
```

(`npm run db:push` etc. resolve the workspace-local `supabase` binary. Plain
`supabase …` only works if you also have it installed globally.)

CI runs `supabase db reset` against a scratch database to verify every migration
applies cleanly from zero (the "migration check" in M0.4).
