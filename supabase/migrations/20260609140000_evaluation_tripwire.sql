-- 20260609140000_evaluation_tripwire.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- THE TRIPWIRE — fires the Autonomous Referee (bbf-evaluate-athlete-progress) via
-- pg_net whenever an athlete's telemetry is INSERTED or UPDATED in
-- bbf_athlete_progression. Fire-and-forget (async pg_net) — it NEVER blocks or fails
-- the athlete's own write.
--
-- (Renamed from the brief's "20260608_…" to a sortable timestamp AFTER the existing
--  migrations — a 20260608 prefix would replay before them on a fresh db reset.)
--
-- ⚠ NOT auto-applied — staged for structural review per the directive. Before applying:
--   • pg_net is enabled (confirmed).
--   • Set the shared secret the trigger sends + the function verifies. Recommended:
--       select vault.create_secret('<random>', 'bbf_evaluator_secret');
--     then read it via vault in the trigger (placeholder GUC below for review), and
--     set EVALUATOR_WEBHOOK_SECRET on the edge function to the SAME value.
--   • Deploy bbf-evaluate-athlete-progress with verify_jwt:false.
--   • LOOP-SAFETY: the edge fn writes ONLY bbf_active_clients (never this table), so
--     the trigger cannot recurse. Do NOT add a write-back to bbf_athlete_progression
--     inside the function without an explicit re-entry guard.

create or replace function public._bbf_evaluate_progress_tripwire()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_fn_url text := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-evaluate-athlete-progress';
  -- Shared secret. For review this reads a GUC; in production prefer Vault
  -- (vault.decrypted_secrets) so the secret is never stored in the catalog plaintext.
  v_secret text := coalesce(current_setting('app.bbf_evaluator_secret', true), '');
begin
  -- Fire-and-forget HTTP POST. Wrapped so a pg_net hiccup can never block the write.
  begin
    perform net.http_post(
      url     := v_fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BBF-Evaluator-Secret', v_secret
      ),
      body    := jsonb_build_object(
        'user_id',            NEW.user_id,
        'sport',              NEW.sport,
        'phase',              NEW.phase,
        'target_phase',       NEW.target_phase,
        'protocol_completed', NEW.protocol_completed,
        'mesocycle_week',     NEW.mesocycle_week,
        'rpe_avg_last_3',     NEW.rpe_avg_last_3,
        'friction_avg_last_3',NEW.friction_avg_last_3,
        'guardian_consent',   NEW.guardian_consent
      )
    );
  exception when others then
    raise warning '[bbf tripwire] net.http_post failed: %', sqlerrm;
  end;
  return NEW;
end;
$$;

drop trigger if exists bbf_athlete_progress_tripwire on public.bbf_athlete_progression;
create trigger bbf_athlete_progress_tripwire
  after insert or update on public.bbf_athlete_progression
  for each row
  execute function public._bbf_evaluate_progress_tripwire();
