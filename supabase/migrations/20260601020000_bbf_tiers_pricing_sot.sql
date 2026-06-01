-- ═══════════════════════════════════════════════════════════════
-- bbf_tiers — single source of truth for pricing tiers
-- ───────────────────────────────────────────────────────────────
-- Canonical pricing matrix (marketing, 2026-06): 13 tiers across
-- fitness / nutrition / youth (recurring) and hybrid 6/8/12-week
-- (one_time). stripe_price_id / stripe_payment_link are nullable —
-- to be populated once the Stripe products/links are created.
--
-- Also expands bbf_admin_set_tier's allowlist to the UNION of the 13
-- new canonical slugs + the 7 legacy slugs, so the live monolith
-- storefront (still sending legacy slugs) keeps provisioning during
-- the React migration. Legacy slugs are stripped in a later phase
-- once the monolith checkout is retired.
--
-- RLS enabled, no policies (service-role only for now). A public-read
-- policy or a read edge-fn is the follow-up for React marketing to
-- consume this table.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.bbf_tiers (
  slug                text primary key,
  category            text not null,
  display_name        text not null,
  price_cents         integer not null,
  billing_type        text not null check (billing_type in ('recurring','one_time')),
  stripe_price_id     text,
  stripe_payment_link text,
  created_at          timestamptz not null default now()
);

comment on table public.bbf_tiers is
  'Single source of truth for pricing tiers (marketing matrix 2026-06). Service-role writes only.';

alter table public.bbf_tiers enable row level security;
-- Intentionally no policies yet: service role only. Add a public-read
-- policy (or a read edge function) when React marketing consumes this.

-- ─── Seed: 13 canonical tiers (idempotent) ─────────────────────────
insert into public.bbf_tiers (slug, category, display_name, price_cents, billing_type) values
  ('catalyst',              'fitness',     'Catalyst',                      999,  'recurring'),
  ('momentum',              'fitness',     'Momentum',                     1999,  'recurring'),
  ('autonomous',            'fitness',     'Autonomous',                   4999,  'recurring'),
  ('fuel_foundation',       'nutrition',   'Fuel: Foundation',              799,  'recurring'),
  ('fuel_performance',      'nutrition',   'Fuel: Performance',            1499,  'recurring'),
  ('fuel_sovereign',        'nutrition',   'Fuel: Sovereign',              2999,  'recurring'),
  ('rising_athlete',        'youth',       'Rising Athlete',               1499,  'recurring'),
  ('kickstart_6wk_3x',      'hybrid_6wk',  'Kickstart 6-Week (3x/wk)',    39900,  'one_time'),
  ('kickstart_6wk_4x',      'hybrid_6wk',  'Kickstart 6-Week (4x/wk)',    49900,  'one_time'),
  ('transformation_8wk_3x', 'hybrid_8wk',  'Transformation 8-Week (3x/wk)',49900, 'one_time'),
  ('transformation_8wk_4x', 'hybrid_8wk',  'Transformation 8-Week (4x/wk)',64900, 'one_time'),
  ('sovereign_12wk_3x',     'hybrid_12wk', 'Sovereign 12-Week (3x/wk)',   69900,  'one_time'),
  ('sovereign_12wk_4x',     'hybrid_12wk', 'Sovereign 12-Week (4x/wk)',   89900,  'one_time')
on conflict (slug) do nothing;

-- ─── Expand bbf_admin_set_tier allowlist (UNION: 13 new + 7 legacy) ─
create or replace function public.bbf_admin_set_tier(p_uid text, p_tier text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_allowed_tiers text[] := ARRAY[
    -- 13 canonical (marketing matrix 2026-06)
    'catalyst','momentum','autonomous',
    'fuel_foundation','fuel_performance','fuel_sovereign',
    'rising_athlete',
    'kickstart_6wk_3x','kickstart_6wk_4x',
    'transformation_8wk_3x','transformation_8wk_4x',
    'sovereign_12wk_3x','sovereign_12wk_4x',
    -- 7 legacy (kept live until the monolith storefront is retired)
    'lite','gateway','architect','sovereign',
    'youth_athlete','nutrition_essentials','nutrition_platinum'
  ];
begin
  IF p_uid IS NULL OR length(p_uid) = 0 THEN
    RAISE EXCEPTION 'invalid_uid';
  END IF;

  IF p_tier IS NULL OR NOT (p_tier = ANY(v_allowed_tiers)) THEN
    RAISE EXCEPTION 'invalid_tier';
  END IF;

  IF p_uid = 'akeem' AND p_tier <> 'sovereign' THEN
    RAISE EXCEPTION 'akeem_locked_to_sovereign';
  END IF;

  SELECT id INTO v_user_id
    FROM public.bbf_users
   WHERE uid = p_uid
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  UPDATE public.bbf_users
     SET subscription_tier = p_tier,
         updated_at        = NOW()
   WHERE id = v_user_id;

  RETURN p_tier;
END;
$function$;
