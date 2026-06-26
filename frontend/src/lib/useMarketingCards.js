// src/lib/useMarketingCards.js
// ─────────────────────────────────────────────────────────────────────────────
// Public read of a Content-Engine card deck (the operator-editable marketing CTA
// cards). FAIL-OPEN, same doctrine as useEntitlement: on RPC error / empty deck /
// not-deployed, this returns null so the caller renders its HARDCODED fallback deck —
// the landing can never blank because the DB hiccupped. A non-empty deck overrides it.

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';

export function useMarketingCards(deck) {
  const [cards, setCards] = useState(null); // null ⇒ caller uses its hardcoded fallback

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc('bbf_get_marketing_cards', { p_deck: deck })
      .then(({ data, error }) => {
        if (cancelled || error) return;                         // transport / not-deployed → fallback
        if (!Array.isArray(data) || data.length === 0) return;  // empty deck → fallback
        setCards(data);
      })
      .catch(() => { /* network throw → fallback */ });
    return () => { cancelled = true; };
  }, [deck]);

  return cards;
}
