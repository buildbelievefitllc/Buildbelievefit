-- Content Engine — operator-editable marketing CTA cards (the "Earn The Vault"
-- calibration deck and any future deck). The public landing reads the active deck
-- via an anon RPC and falls back to its hardcoded array if empty/unavailable; the
-- Command Center "Content" panel edits cards via admin-gated RPCs. Trilingual by
-- design (§1): every editable string carries en/es/pt columns.
--
-- SECURITY: the table is RLS-CLOSED (no policies) — ALL access flows through these
-- SECURITY DEFINER RPCs. Reads are anon (marketing copy is public). Writes require a
-- valid admin vault session, gated by _bbf_is_admin_session (migration 20260609150000),
-- identical to bbf_admin_reset_user_pin.

create table if not exists public.bbf_marketing_cards (
  id          uuid primary key default gen_random_uuid(),
  deck        text        not null default 'calibration',
  sort        integer     not null default 0,
  idx         text        not null default '',
  tone        text        not null default 'locked',   -- locked | ignite | open (accent)
  state_en    text default '', state_es text default '', state_pt text default '',
  lead_en     text default '', lead_es text default '', lead_pt text default '',
  body_en     text default '', body_es text default '', body_pt text default '',
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists bbf_marketing_cards_deck_sort_idx
  on public.bbf_marketing_cards (deck, sort);

-- RLS on, no policies → table is closed to anon/authenticated direct access; only the
-- SECURITY DEFINER functions below (which run as owner) can touch it.
alter table public.bbf_marketing_cards enable row level security;

-- ── Public read: the active deck, ordered, all languages (caller picks per lang). ──
create or replace function public.bbf_get_marketing_cards(p_deck text)
returns table (
  id uuid, sort integer, idx text, tone text,
  state_en text, state_es text, state_pt text,
  lead_en text, lead_es text, lead_pt text,
  body_en text, body_es text, body_pt text
)
language sql
security definer
set search_path = public
as $$
  select id, sort, idx, tone,
         state_en, state_es, state_pt,
         lead_en, lead_es, lead_pt,
         body_en, body_es, body_pt
    from public.bbf_marketing_cards
   where deck = coalesce(nullif(trim(p_deck), ''), 'calibration')
     and active = true
   order by sort asc, created_at asc;
$$;
grant execute on function public.bbf_get_marketing_cards(text) to anon, authenticated, service_role;

-- ── Admin list: every card for a deck (incl. inactive) for the editor. ──
create or replace function public.bbf_admin_list_marketing_cards(p_session_token text, p_deck text)
returns setof public.bbf_marketing_cards
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._bbf_is_admin_session(p_session_token) then
    raise exception 'not_authorized';
  end if;
  return query
    select * from public.bbf_marketing_cards
     where deck = coalesce(nullif(trim(p_deck), ''), 'calibration')
     order by sort asc, created_at asc;
end;
$$;
grant execute on function public.bbf_admin_list_marketing_cards(text, text) to anon, authenticated, service_role;

-- ── Admin upsert: insert when p_card->>'id' is null, else update. jsonb payload so
--    the (wide, trilingual) card shape stays one tidy argument. ──
create or replace function public.bbf_admin_upsert_marketing_card(p_session_token text, p_card jsonb)
returns public.bbf_marketing_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.bbf_marketing_cards;
  v_id  uuid := nullif(p_card->>'id', '')::uuid;
begin
  if not public._bbf_is_admin_session(p_session_token) then
    raise exception 'not_authorized';
  end if;

  if v_id is null then
    insert into public.bbf_marketing_cards
      (deck, sort, idx, tone, state_en, state_es, state_pt, lead_en, lead_es, lead_pt, body_en, body_es, body_pt, active)
    values (
      coalesce(nullif(trim(p_card->>'deck'), ''), 'calibration'),
      coalesce((p_card->>'sort')::int, 0),
      coalesce(p_card->>'idx', ''),
      coalesce(nullif(trim(p_card->>'tone'), ''), 'locked'),
      coalesce(p_card->>'state_en', ''), coalesce(p_card->>'state_es', ''), coalesce(p_card->>'state_pt', ''),
      coalesce(p_card->>'lead_en', ''), coalesce(p_card->>'lead_es', ''), coalesce(p_card->>'lead_pt', ''),
      coalesce(p_card->>'body_en', ''), coalesce(p_card->>'body_es', ''), coalesce(p_card->>'body_pt', ''),
      coalesce((p_card->>'active')::boolean, true)
    )
    returning * into v_row;
  else
    update public.bbf_marketing_cards set
      deck     = coalesce(nullif(trim(p_card->>'deck'), ''), deck),
      sort     = coalesce((p_card->>'sort')::int, sort),
      idx      = coalesce(p_card->>'idx', idx),
      tone     = coalesce(nullif(trim(p_card->>'tone'), ''), tone),
      state_en = coalesce(p_card->>'state_en', state_en), state_es = coalesce(p_card->>'state_es', state_es), state_pt = coalesce(p_card->>'state_pt', state_pt),
      lead_en  = coalesce(p_card->>'lead_en', lead_en),   lead_es  = coalesce(p_card->>'lead_es', lead_es),   lead_pt  = coalesce(p_card->>'lead_pt', lead_pt),
      body_en  = coalesce(p_card->>'body_en', body_en),   body_es  = coalesce(p_card->>'body_es', body_es),   body_pt  = coalesce(p_card->>'body_pt', body_pt),
      active   = coalesce((p_card->>'active')::boolean, active),
      updated_at = now()
    where id = v_id
    returning * into v_row;
    if not found then
      raise exception 'card_not_found';
    end if;
  end if;

  return v_row;
end;
$$;
grant execute on function public.bbf_admin_upsert_marketing_card(text, jsonb) to anon, authenticated, service_role;

-- ── Admin delete. ──
create or replace function public.bbf_admin_delete_marketing_card(p_session_token text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._bbf_is_admin_session(p_session_token) then
    raise exception 'not_authorized';
  end if;
  delete from public.bbf_marketing_cards where id = p_id;
  return found;
end;
$$;
grant execute on function public.bbf_admin_delete_marketing_card(text, uuid) to anon, authenticated, service_role;

-- ── Seed the live calibration deck (idempotent: only when the deck is empty), copy
--    verbatim from the shipped i18n so the DB mirrors the hardcoded fallback. ──
insert into public.bbf_marketing_cards
  (deck, sort, idx, tone, state_en, state_es, state_pt, lead_en, lead_es, lead_pt, body_en, body_es, body_pt, active)
select * from (values
  ('calibration', 1, '01', 'locked',
   'Locked', 'Bloqueado', 'Bloqueado',
   'Days 1–14 (The Baseline)', 'Días 1–14 (La Base)', 'Dias 1–14 (A Base)',
   'You are locked on the rails. The engine maps you through daily check-ins and strict, clinical prescriptions.',
   'Estás fijo en los rieles. El motor te mapea a través de chequeos diarios y prescripciones estrictas y clínicas.',
   'Você está travado nos trilhos. O motor te mapeia através de check-ins diários e prescrições estritas e clínicas.',
   true),
  ('calibration', 2, '02', 'ignite',
   'Unlocking', 'Desbloqueando', 'Desbloqueando',
   'Days 15–29 (The Ignition)', 'Días 15–29 (La Ignición)', 'Dias 15–29 (A Ignição)',
   'Your custom Phase 10 Smart Cardio unlocks. The engine dynamically routes your recovery.',
   'Tu Cardio Inteligente Fase 10 personalizado se desbloquea. El motor enruta dinámicamente tu recuperación.',
   'Seu Cardio Inteligente Fase 10 personalizado é desbloqueado. O motor roteia dinamicamente sua recuperação.',
   true),
  ('calibration', 3, '03', 'open',
   'Open', 'Abierto', 'Aberto',
   'Day 30 (The Vault Opens)', 'Día 30 (El Cofre se Abre)', 'Dia 30 (O Cofre se Abre)',
   'You graduate. The full Library and dynamic AI audio coaching unlock. You earn your permanent badge as a Sovereign Athlete.',
   'Te gradúas. La Biblioteca completa y el coaching de audio con IA se desbloquean. Ganas tu insignia permanente como Atleta Soberano.',
   'Você se forma. A Biblioteca completa e o coaching de áudio com IA são desbloqueados. Você conquista seu selo permanente como Atleta Soberano.',
   true)
) as seed
where not exists (select 1 from public.bbf_marketing_cards where deck = 'calibration');
