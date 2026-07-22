// send-bp-reminder — Web Push reminder for the BP Tracker PWA.
//
// Reads every saved push subscription and sends "Time to log your blood
// pressure!" via the Web Push protocol (npm:web-push + VAPID). Triggered by
// pg_cron at 15:00 UTC / 03:00 UTC (8 AM / 8 PM America/Phoenix).
//
// Auth: this function is deployed with verify_jwt = FALSE (it is called by the
// database cron, not a signed-in user) and gates itself on a shared secret
// header `x-bp-cron-secret` === env BP_CRON_SECRET. Missing/!match => 401.
//
// Required secrets (supabase secrets set …):
//   BP_CRON_SECRET     — shared secret the cron must present
//   VAPID_PUBLIC_KEY   — VAPID public key (also the frontend VITE_VAPID_PUBLIC_KEY)
//   VAPID_PRIVATE_KEY  — VAPID private key (NEVER in the client bundle)
//   VAPID_SUBJECT      — a mailto: or https: contact URL, e.g. mailto:you@example.com
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import webpush from 'npm:web-push@3.6.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-bp-cron-secret',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  // ── Auth gate ────────────────────────────────────────────────────────────
  const cronSecret = Deno.env.get('BP_CRON_SECRET');
  if (!cronSecret) {
    console.error('[send-bp-reminder] BP_CRON_SECRET not configured');
    return jsonResponse({ error: 'not_configured' }, 500);
  }
  if (req.headers.get('x-bp-cron-secret') !== cronSecret) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  // ── VAPID ────────────────────────────────────────────────────────────────
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@buildbelievefit.fitness';
  if (!vapidPublic || !vapidPrivate) {
    console.error('[send-bp-reminder] VAPID keys not configured');
    return jsonResponse({ error: 'vapid_not_configured' }, 500);
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  // ── Load subscriptions (service role bypasses RLS) ────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, subscription_data');
  if (error) {
    console.error('[send-bp-reminder] load failed:', error);
    return jsonResponse({ error: 'load_failed', detail: error.message }, 500);
  }
  if (!subs || subs.length === 0) {
    return jsonResponse({ ok: true, sent: 0, failed: 0, removed: 0 });
  }

  const payload = JSON.stringify({
    title: 'Time to log your blood pressure! 🩺',
    body: 'Tap to record this reading.',
  });

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription_data, payload);
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404 / 410 => the subscription is gone; prune it so we stop retrying.
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(row.id);
        } else {
          console.warn('[send-bp-reminder] push failed:', statusCode, (err as Error)?.message);
        }
        failed++;
      }
    }),
  );

  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }

  return jsonResponse({ ok: true, sent, failed, removed: staleIds.length });
});
