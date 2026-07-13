# ClimbIQ backend

Orchestrator service (Fastify + `@nosana/kit`) — service code lands in milestone M3.
For now this package holds the Supabase configuration and SQL migrations.

## Supabase migration workflow (spec §7.1 — read before touching the schema)

Schema is managed **exclusively** through SQL files in `supabase/migrations/` —
never hand-edit tables in the Supabase dashboard.

- File naming: `YYYYMMDDHHMMSS_short_name.sql` (sortable timestamp prefix).
- Every table ships with RLS enabled + policies and its indexes in the same migration.

### Commands (Supabase CLI)

```sh
supabase login                 # once
supabase link --project-ref <ref>   # once per machine, ref from dashboard URL
supabase db push               # apply pending local migrations to the remote DB
supabase db reset              # local dev DB only: recreate from all migrations
supabase migration new <name>  # scaffold a new timestamped migration file
```

CI runs `supabase db reset` against a scratch database to verify every migration
applies cleanly from zero (the "migration check" in M0.4).
