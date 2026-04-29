# Supabase CLI Workflow

This directory holds the canonical schema state for the `bbf-lab` Supabase project (`ihclbceghxpuawymlvgi`). From Phase 3 P1 onward, **every database change ships through this directory** as a tracked migration — no more dashboard pasting.

## Layout

```
supabase/
├── config.toml          # Project config (links to ihclbceghxpuawymlvgi, declares Postgres 17)
├── .gitignore           # Ignores .branches/, .temp/, .env (CLI ephemeral state)
├── README.md            # You are here
└── migrations/
    ├── 20260101000000_baseline.sql                # Production state captured 2026-04-29
    └── 20260429054308_phase2_hotfix_uid_column    # ← TODO: not yet in repo
```

The baseline is intentionally pre-dated (Jan 1 2026) so it sorts before the already-applied `phase2_hotfix_uid_column` migration that lives only in Supabase's `_migrations` table. After repair (see below), Supabase will see both migrations as applied and the local history as complete.

> **Open question:** the `phase2_hotfix_uid_column` migration is registered with Supabase but its source file is not yet in this repo. It will need to be reconstructed from `pg_dump` of the migration record and added to this directory in a follow-up so the migration history is fully reproducible. Tracked as a Phase 3 P1 follow-up.

## One-time setup (do this once)

You'll need to do this on whatever machine you'll be running migrations from.

### 1. Install the Supabase CLI

Pick your platform:

```bash
# macOS (Homebrew)
brew install supabase/tap/supabase

# Linux / WSL (npm)
npm install -g supabase

# Linux / WSL (binary)
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/

# Verify
supabase --version
```

### 2. Get an access token

Go to https://supabase.com/dashboard/account/tokens, create a token named `bbf-cli`, copy the value. Then:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."
# Or persist in your shell profile (~/.zshrc, ~/.bashrc, etc.)
```

### 3. Link the project

From the repo root:

```bash
supabase link --project-ref ihclbceghxpuawymlvgi
```

The CLI will prompt for the database password. You can find it in Supabase Dashboard → Project Settings → Database → "Database password" (or reset it there if you don't have it). After linking, `supabase/.temp/project-ref` is created (gitignored).

### 4. Mark the baseline + hotfix as already-applied

This is the critical step. Production already contains everything in the baseline; we don't want to re-apply it. Tell Supabase the migration history is "already applied":

```bash
supabase migration repair --status applied 20260101000000
supabase migration repair --status applied 20260429054308
```

Verify:

```bash
supabase migration list
# Both rows should show "applied" in the Remote column.
```

You're now wired up. Future migrations will queue from `20260429054309` onward.

## Day-to-day workflow (every change)

### Author a new migration

```bash
supabase migration new descriptive_name
```

This creates `supabase/migrations/<timestamp>_descriptive_name.sql`. Edit it with the SQL changes — schema, RLS policy, function, etc. Use idempotent constructs (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS`) so re-runs are safe.

### Apply to production

```bash
supabase db push
```

The CLI compares local migrations against Supabase's record, applies only what's new, and updates the remote record.

### Commit + push to git

```bash
git add supabase/migrations/<the_new_file>
git commit -m "feat(db): <what changed and why>"
git push
```

Open a PR. The diff *is* the schema change — reviewable, blameable, revertible.

## Two paths for applying migrations

We have two routes for getting SQL into production:

### Path A — Supabase CLI (this workflow)

`supabase db push` from your local machine. Requires CLI install + access token.

### Path B — Claude via Supabase MCP

When Claude is connected to the Supabase MCP server (i.e. inside a Claude Code session), `mcp__Supabase__apply_migration` writes both the migration record and the schema change in one atomic call. Equivalent to `supabase db push` but no CLI install needed on the user's machine.

**Both paths produce the same result**: a row in Supabase's `_migrations` table and a corresponding `.sql` file in this directory. Whichever tool authored the change, the other can read its history.

The convention going forward:
- **Claude does it via MCP** during a Claude Code session, then commits the file
- **You do it via CLI** when working locally without Claude
- Either way, the file lands in `supabase/migrations/` and the migration record lands in Supabase. They mirror each other.

## What NOT to do

- Don't paste SQL into the dashboard SQL editor. The change will run, but Supabase won't record it as a migration and the repo won't have the file. That's exactly the drift we just spent two phases cleaning up.
- Don't edit a migration file after it's been applied. Once a timestamped migration is in the `_migrations` table, the file is immutable. New changes go in a new file.
- Don't delete migration files from this directory. Even superseded ones are part of the historical record.

## Phase 3 P1 follow-ups

- [ ] **Add `20260429054308_phase2_hotfix_uid_column.sql` to this directory.** The migration record exists in Supabase but the source file does not. Reconstruct from the existing RPC definitions and commit so history is fully reproducible.
- [ ] **First real migration through this workflow:** the RLS hardening pass — enable RLS on `bbf_sets` and `bbf_readiness`, add appropriate policies on `bbf_users` and `bbf_logs`. See `api/SCHEMA_DRIFT_REPORT.md` D10 for context.
