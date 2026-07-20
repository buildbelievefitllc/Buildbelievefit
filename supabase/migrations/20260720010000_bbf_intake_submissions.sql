-- 20260720010000_bbf_intake_submissions.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Sovereign Intake capture — the durable landing table for the /assessment
-- wizard payload (goals, biometrics, availability, injury constraints), written
-- on the user's first authenticated load (PendingIntakeSync consumes
-- localStorage['bbf_pending_intake']).
--
-- WHY A DEDICATED TABLE (not a direct bbf_users write): bbf_users has no intake
-- columns and the OAuth auth.uid() ↔ bbf_users.id mapping is not established
-- here; blind-writing the core users table on a drifted prod DB is unsafe. This
-- captures the intake keyed to auth.uid() so an identity-aware downstream step can
-- reconcile it into the profile ledger. Additive only — touches no existing object.
--
-- Security (CLAUDE.md §7 + DATABASE_SAFETY.md): RLS on. An authenticated user may
-- INSERT ONLY their own row (with check auth.uid() = user_id); no SELECT/UPDATE/
-- DELETE for anon/authenticated. service_role (bypasses RLS) does the downstream read.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.bbf_intake_submissions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid(),
  payload     jsonb       not null,
  source      text,
  created_at  timestamptz not null default now()
);

comment on table public.bbf_intake_submissions is
  'Sovereign Intake wizard payloads captured on first authenticated load. RLS: self-insert only.';

create index if not exists bbf_intake_submissions_user_idx
  on public.bbf_intake_submissions (user_id, created_at desc);

alter table public.bbf_intake_submissions enable row level security;

-- Least privilege: no anon access; authenticated may INSERT only (rows gated to self).
revoke all on table public.bbf_intake_submissions from anon, authenticated;
grant insert on table public.bbf_intake_submissions to authenticated;
grant all on table public.bbf_intake_submissions to service_role;

drop policy if exists bbf_intake_self_insert on public.bbf_intake_submissions;
create policy bbf_intake_self_insert
  on public.bbf_intake_submissions
  for insert
  to authenticated
  with check (auth.uid() = user_id);
