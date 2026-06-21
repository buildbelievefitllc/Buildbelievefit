// src/lib/avatarApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Avatar server persistence (migration 20260621150000). The Sports Hub uploads a
// compressed ~256px JPEG data URL; localStorage is the instant on-device cache,
// but bbf_users.avatar is the source of truth so the photo follows the athlete
// cross-device AND surfaces in the Command Center sports roster.
//
// Both RPCs self-gate on the stored 24h vault session token (granted to anon /
// authenticated) → resolve the athlete server-side. No admin role required: an
// athlete only ever reads/writes their own row.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Pull the persisted avatar for the signed-in athlete. Returns '' when none is
// stored or there is no live session (caller keeps whatever local cache it has).
export async function fetchAvatar() {
  const token = getStoredVaultToken();
  if (!token) return '';
  try {
    const { data, error } = await supabase.rpc('bbf_get_avatar', { p_session_token: token });
    if (error) return '';
    return (data && data.avatar) || '';
  } catch {
    return '';
  }
}

// Push the avatar (data URL, or null to clear) to the server. Best-effort: a
// network/quota failure must never block the local-first UI update. Resolves to
// true on success, false otherwise.
export async function pushAvatar(dataUrl) {
  const token = getStoredVaultToken();
  if (!token) return false;
  try {
    const { error } = await supabase.rpc('bbf_set_avatar', {
      p_session_token: token,
      p_avatar: dataUrl || null,
    });
    return !error;
  } catch {
    return false;
  }
}
