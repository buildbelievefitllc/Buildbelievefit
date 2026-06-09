-- Native Sports Engine staging column. The Pathfinder intake (PathfinderForm.jsx
-- → lib/sportsEngine.js) generates a sport-agnostic athletic-development protocol
-- for youth/collegiate performance athletes; bbf-lead-capture writes it here (keyed
-- by vault_email), and the login plan envelope surfaces it to the Athlete Portal
-- (SportsHub → SportProtocol). text, mirroring the workout_plan / meal_plan JSON-text
-- columns. Additive; service-role + the login SECURITY DEFINER RPC are the only
-- readers/writers.
alter table public.bbf_active_clients
  add column if not exists sports_protocol text;

comment on column public.bbf_active_clients.sports_protocol is
  'Native Sports Engine protocol JSON (text). Staged at intake by bbf-lead-capture for youth/collegiate athletes; surfaced to the Athlete Portal via the login plan envelope.';
