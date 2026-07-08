-- ═══════════════════════════════════════════════════════════════════════════
-- THE HARDWIRE GATEWAY — bbf_admin_forge_athlete
--
-- God-mode onboarding bypass for the Founder Five Command Center: one admin
-- call forges a complete athlete — credentials, profile, clinical intake, and
-- initial protocol — skipping the consumer funnel while ENFORCING clinical
-- data collection (biomechanical + metabolic profiles are first-class fields).
--
-- ATOMICITY (zero data orphans): a plpgsql function body is a single
-- transaction — ANY raised exception rolls back every insert (bbf_users,
-- bbf_active_clients, athlete_profiles) as one unit. Validation failures
-- raise instead of returning soft errors for exactly this reason.
--
-- The cascade mirrors the REAL funnel so a forged athlete is indistinguishable
-- from a provisioned one downstream:
--   • bbf_users         — auth identity (uid + bcrypt pin_hash, same
--                         crypt(gen_salt('bf')) as bbf_provision_client_pin),
--                         role/tier, macros, dietary + allergen jsonb,
--                         meal_plan, sport/position for youth.
--   • bbf_active_clients— the intake record the PIN login joins by
--                         email = vault_email: age, height/weight, the composed
--                         CLINICAL HISTORY (injuries · joint limitations ·
--                         surgeries), sports_protocol (::text, same store the
--                         Manual Override writes), meal_plan, macros, language.
--   • athlete_profiles  — youth only (UNIQUE user_id): unlocks the youth
--                         surfaces + the nutrition_daily_sync history join.
--
-- The sports_protocol / meal_plan payloads are built CLIENT-SIDE by the same
-- deterministic engines the funnel + Manual Override run (buildSportsProtocol
-- with biomech exclusions applied · buildMealPlan with the allergen safety
-- net) and passed in as jsonb — the RPC stores them verbatim (::text parity
-- with migration 20260609150000).
--
-- Returns { ok, credentials:{ uid, pin }, client:{ roster row } }. The PIN is
-- returned ONCE, unhashed, for the coach to hand to the athlete — only the
-- bcrypt hash is stored.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.bbf_admin_forge_athlete(
  p_session_token text,
  p_payload       jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name        text := btrim(coalesce(p_payload->>'name', ''));
  v_typology    text := lower(coalesce(p_payload->>'typology', 'general'));
  v_age         int  := nullif(p_payload->>'age', '')::int;
  v_gender      text := nullif(btrim(coalesce(p_payload->>'gender', '')), '');
  v_weight      text := nullif(btrim(coalesce(p_payload->>'weight', '')), '');
  v_height      text := nullif(btrim(coalesce(p_payload->>'height', '')), '');
  v_tier        text := nullif(btrim(coalesce(p_payload->>'tier', '')), '');
  v_email_in    text := lower(nullif(btrim(coalesce(p_payload->>'email', '')), ''));
  v_lang        text := lower(coalesce(nullif(p_payload->>'language', ''), 'en'));
  v_diet        text := coalesce(nullif(btrim(coalesce(p_payload->>'dietary_profile', '')), ''), 'Omnivore');
  v_injuries    jsonb := coalesce(p_payload->'injuries', '[]'::jsonb);
  v_joints      jsonb := coalesce(p_payload->'joint_limitations', '[]'::jsonb);
  v_surgeries   jsonb := coalesce(p_payload->'surgeries', '[]'::jsonb);
  v_allergens   jsonb := coalesce(p_payload->'allergens', '[]'::jsonb);
  v_intoler     jsonb := coalesce(p_payload->'intolerances', '[]'::jsonb);
  v_dislikes    jsonb := coalesce(p_payload->'food_dislikes', '[]'::jsonb);
  v_tdee        int  := nullif(p_payload->>'tdee_target', '')::int;
  v_p           int  := nullif(p_payload->>'macro_p', '')::int;
  v_c           int  := nullif(p_payload->>'macro_c', '')::int;
  v_f           int  := nullif(p_payload->>'macro_f', '')::int;
  v_sport       text := nullif(btrim(coalesce(p_payload->>'sport', '')), '');
  v_position    text := nullif(btrim(coalesce(p_payload->>'position', '')), '');
  v_protocol    jsonb := p_payload->'sports_protocol';
  v_meal_plan   jsonb := p_payload->'meal_plan';

  v_first       text;
  v_base        text;
  v_uid         text;
  v_attempt     int := 0;
  v_pin         text;
  v_email       text;
  v_user_id     uuid;
  v_hw          text;
  v_clinical    text;
  v_now         timestamptz := now();
begin
  -- ── gate + validation (raise ⇒ full rollback; no partial writes possible) ──
  if not public._bbf_is_admin_session(p_session_token) then
    raise exception 'not_authorized';
  end if;
  if v_name = '' then raise exception 'missing_name'; end if;
  if v_typology not in ('youth', 'general') then raise exception 'invalid_typology'; end if;
  if v_age is not null and (v_age < 5 or v_age > 100) then raise exception 'invalid_age'; end if;
  if v_typology = 'youth' and v_age is null then raise exception 'youth_requires_age'; end if;
  if v_tdee is not null and (v_tdee < 0 or v_tdee > 20000) then raise exception 'invalid_tdee'; end if;
  if v_lang not in ('en', 'es', 'pt') then v_lang := 'en'; end if;
  if v_email_in is not null and v_email_in !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  if v_email_in is not null and exists (select 1 from public.bbf_users where lower(email) = v_email_in) then
    raise exception 'email_taken';
  end if;

  -- ── uid: first-name base + '_bbf', numeric suffix on collision (parity with
  --    bbf_provision_client_pin) ──────────────────────────────────────────────
  v_first := lower(split_part(v_name, ' ', 1));
  v_base  := substring(regexp_replace(v_first, '[^a-z]', '', 'g') from 1 for 20);
  if v_base = '' then v_base := 'athlete'; end if;
  loop
    v_uid := case when v_attempt = 0 then v_base || '_bbf'
                  else v_base || (v_attempt + 1)::text || '_bbf' end;
    exit when not exists (select 1 from public.bbf_users where uid = v_uid);
    v_attempt := v_attempt + 1;
    if v_attempt > 99 then
      v_uid := v_base || substring(md5(random()::text) from 1 for 4) || '_bbf';
      exit;
    end if;
  end loop;

  -- ── credentials: 6-digit PIN, bcrypt-stored, returned once in cleartext ────
  v_pin   := lpad(floor(random() * 1000000)::int::text, 6, '0');
  -- vault_email is the bbf_users↔bbf_active_clients join key (UNIQUE) — a
  -- forged athlete with no real email gets a deterministic forge alias.
  v_email := coalesce(v_email_in, v_uid || '@forge.buildbelievefit.fitness');

  -- ── composed clinical history (biomechanical profile, human-readable in the
  --    same clinical_history field the funnel intake populates) ───────────────
  v_hw := nullif(concat_ws(' · ', v_height, v_weight), '');
  v_clinical := nullif(concat_ws(e'\n',
    case when jsonb_array_length(v_injuries)  > 0 then 'Injury history: '     || (select string_agg(x, ', ') from jsonb_array_elements_text(v_injuries)  t(x)) end,
    case when jsonb_array_length(v_joints)    > 0 then 'Joint limitations: '  || (select string_agg(x, ', ') from jsonb_array_elements_text(v_joints)    t(x)) end,
    case when jsonb_array_length(v_surgeries) > 0 then 'Past surgeries: '     || (select string_agg(x, ', ') from jsonb_array_elements_text(v_surgeries) t(x)) end,
    case when jsonb_array_length(v_intoler)   > 0 then 'Food intolerances: '  || (select string_agg(x, ', ') from jsonb_array_elements_text(v_intoler)   t(x)) end
  ), '');

  -- ── 1 · auth identity + coaching profile ───────────────────────────────────
  insert into public.bbf_users (
    uid, name, email, pin_hash, role, subscription_tier,
    tdee_target, macro_p, macro_c, macro_f,
    dietary_profile, allergens, food_dislikes,
    sport, "position", preferred_locale,
    meal_plan, plans_generated_at
  ) values (
    v_uid, v_name, v_email, crypt(v_pin, gen_salt('bf')), 'client', v_tier,
    v_tdee, v_p, v_c, v_f,
    v_diet, v_allergens, v_dislikes || v_intoler,   -- intolerances ride the dislike filter the meal engines already honor
    case when v_typology = 'youth' then v_sport else null end,
    case when v_typology = 'youth' then v_position else null end,
    v_lang,
    case when v_meal_plan is not null then v_meal_plan::text else null end,
    case when v_meal_plan is not null or v_protocol is not null then v_now else null end
  ) returning id into v_user_id;

  -- ── 2 · intake record (the PIN login joins email = vault_email) ────────────
  insert into public.bbf_active_clients (
    client_name, client_email, vault_email, age, height_weight,
    clinical_history, spectrum_tier, onboarding_status, liability_cleared,
    dietary_profile, allergens, food_likes, food_dislikes,
    tdee_target, macro_p, macro_c, macro_f,
    sports_protocol, workout_plan, meal_plan, plans_generated_at, preferred_language
  ) values (
    v_name, v_email, v_email, v_age, v_hw,
    v_clinical, v_tier, 'forged_hardwire', false,
    v_diet, v_allergens, '[]'::jsonb, v_dislikes || v_intoler,
    v_tdee, v_p, v_c, v_f,
    case when v_protocol is not null then v_protocol::text else null end,
    null,
    case when v_meal_plan is not null then v_meal_plan::text else null end,
    case when v_meal_plan is not null or v_protocol is not null then v_now else null end,
    v_lang
  );

  -- ── 3 · youth: athlete_profiles row (youth surfaces + fueling-history join) ─
  if v_typology = 'youth' then
    insert into public.athlete_profiles
      (user_id, full_name, birth_date, gender, sport, "position",
       current_tier, preferred_language, dietary_restrictions)
    values (
      v_user_id, v_name,
      (current_date - make_interval(years => v_age))::date,  -- age-derived anchor
      v_gender, coalesce(v_sport, 'general'), v_position,
      'youth', v_lang,
      coalesce((select array_agg(x) from jsonb_array_elements_text(v_allergens) t(x)), '{}'::text[])
    )
    on conflict (user_id) do nothing;
  end if;

  -- ── forged: credentials once, roster-shaped row for the optimistic insert ──
  return jsonb_build_object(
    'ok', true,
    'credentials', jsonb_build_object('uid', v_uid, 'pin', v_pin),
    'client', jsonb_build_object(
      'id', v_user_id, 'uid', v_uid, 'name', v_name, 'email', v_email,
      'role', 'client', 'metabolic_tier', null, 'subscription_tier', v_tier,
      'tdee_target', v_tdee, 'account_status', 'active', 'updated_at', v_now
    )
  );
end;
$$;

grant execute on function public.bbf_admin_forge_athlete(text, jsonb) to anon, authenticated, service_role;
