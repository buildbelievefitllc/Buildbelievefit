// create-google-doc — export the last 30 days of BP readings into a clean,
// shareable Google Doc for the doctor.
//
// Flow:
//   1. Authenticate as a Google service account (RS256 JWT → OAuth token).
//   2. Pull the last 30 days of bp_logs (service role).
//   3. Create a Doc, insert a formatted 5-column table (Date, Time, Systolic,
//      Diastolic, Notes), bold the header row.
//   4. Share it with the reader's Gmail (BP_DOC_SHARE_EMAIL / body.share_email).
//   5. Return { doc_url }.
//
// Called from the PWA via supabase.functions.invoke → deployed with
// verify_jwt = TRUE (the browser sends the anon key as Bearer).
//
// Required secrets (supabase secrets set …):
//   GOOGLE_SERVICE_ACCOUNT_KEY — the full service-account JSON (as a string)
//   BP_DOC_SHARE_EMAIL         — the Gmail address to share the doc with
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── base64url helpers ───────────────────────────────────────────────────────
function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlStr(str: string): string {
  return b64url(new TextEncoder().encode(str));
}

// PEM (PKCS#8) → CryptoKey for RS256 signing.
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

// Service-account JWT → OAuth2 access token (Docs + Drive scopes).
async function getAccessToken(sa: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope:
      'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(
    JSON.stringify(claim),
  )}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(signingInput),
    ),
  );
  const assertion = `${signingInput}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`token exchange failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

async function docsBatchUpdate(
  token: string,
  documentId: string,
  requests: unknown[],
): Promise<void> {
  const res = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    },
  );
  if (!res.ok) {
    throw new Error(`docs batchUpdate failed (${res.status}): ${await res.text()}`);
  }
}

// Row-major list of the empty table's cell insertion indices.
type DocNode = {
  table?: { tableRows?: Array<{ tableCells?: Array<{ content?: Array<{ startIndex?: number }> }> }> };
};
function collectCellIndices(doc: { body?: { content?: DocNode[] } }): number[] {
  const content = doc.body?.content ?? [];
  const table = content.find((el) => el.table)?.table;
  const indices: number[] = [];
  for (const rowNode of table?.tableRows ?? []) {
    for (const cell of rowNode.tableCells ?? []) {
      const start = cell.content?.[0]?.startIndex;
      if (typeof start === 'number') indices.push(start);
    }
  }
  return indices;
}

const AZ_TZ = 'America/Phoenix';
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: AZ_TZ,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
function fmtTime(iso: string, timeOfDay: string): string {
  const clock = new Date(iso).toLocaleTimeString('en-US', {
    timeZone: AZ_TZ,
    hour: 'numeric',
    minute: '2-digit',
  });
  const label = timeOfDay === 'morning' ? 'Morning' : 'Evening';
  return `${label} · ${clock}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  try {
    const rawKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!rawKey) return jsonResponse({ error: 'google_not_configured' }, 500);

    let sa: { client_email: string; private_key: string };
    try {
      sa = JSON.parse(rawKey);
    } catch {
      return jsonResponse({ error: 'bad_service_account_json' }, 500);
    }

    let shareEmail = Deno.env.get('BP_DOC_SHARE_EMAIL') ?? '';
    try {
      const body = await req.json();
      if (body?.share_email) shareEmail = String(body.share_email);
    } catch {
      /* empty body is fine */
    }

    // ── Pull the last 30 days ────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs, error } = await supabase
      .from('bp_logs')
      .select('created_at, systolic, diastolic, time_of_day, notes')
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[create-google-doc] query failed:', error);
      return jsonResponse({ error: 'query_failed', detail: error.message }, 500);
    }

    const token = await getAccessToken(sa);

    // ── 1. Create the document ───────────────────────────────────────────────
    const title = `Blood Pressure Log — ${new Date().toLocaleDateString('en-US', {
      timeZone: AZ_TZ,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });
    if (!createRes.ok) {
      throw new Error(`doc create failed (${createRes.status}): ${await createRes.text()}`);
    }
    const documentId = (await createRes.json()).documentId as string;

    const headers = ['Date', 'Time', 'Systolic', 'Diastolic', 'Notes'];
    const COLS = headers.length;
    const rows = (logs ?? []).map((r) => [
      fmtDate(r.created_at),
      fmtTime(r.created_at, r.time_of_day),
      String(r.systolic),
      String(r.diastolic),
      r.notes ? String(r.notes) : '—',
    ]);
    const tableData = [headers, ...rows];

    // ── 2. Insert heading + empty table (append at end of body) ──────────────
    const subtitle = `Last 30 days · ${rows.length} reading${rows.length === 1 ? '' : 's'} · generated ${new Date().toLocaleString('en-US', { timeZone: AZ_TZ })} (AZ)`;
    await docsBatchUpdate(token, documentId, [
      { insertText: { endOfSegmentLocation: {}, text: `Blood Pressure Log\n${subtitle}\n\n` } },
      { insertTable: { endOfSegmentLocation: {}, rows: tableData.length, columns: COLS } },
    ]);

    // ── 3. Fill cells — GET indices, then insert text in REVERSE order ───────
    const getRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}?fields=body(content(table(tableRows(tableCells(content(startIndex))))))`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!getRes.ok) {
      throw new Error(`doc get failed (${getRes.status}): ${await getRes.text()}`);
    }
    const cellIndices = collectCellIndices(await getRes.json());
    const flatText = tableData.flat();

    if (cellIndices.length === flatText.length) {
      const fillRequests = cellIndices
        .map((index, i) => ({ index, text: flatText[i] }))
        // Insert from the highest index first so earlier indices stay valid.
        .sort((a, b) => b.index - a.index)
        .map(({ index, text }) => ({ insertText: { location: { index }, text } }));
      await docsBatchUpdate(token, documentId, fillRequests);

      // ── 4. Bold the header row (re-read to get post-fill ranges) ───────────
      const getRes2 = await fetch(
        `https://docs.googleapis.com/v1/documents/${documentId}?fields=body(content(table(tableRows(tableCells(content(startIndex,endIndex))))))`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (getRes2.ok) {
        const doc2 = await getRes2.json();
        const table = (doc2.body?.content ?? []).find((el: DocNode) => el.table)?.table;
        const headerCells = table?.tableRows?.[0]?.tableCells ?? [];
        const styleReqs = headerCells
          .map((cell: { content?: Array<{ startIndex?: number; endIndex?: number }> }) => {
            const c = cell.content?.[0];
            if (typeof c?.startIndex !== 'number' || typeof c?.endIndex !== 'number') return null;
            return {
              updateTextStyle: {
                range: { startIndex: c.startIndex, endIndex: c.endIndex },
                textStyle: { bold: true },
                fields: 'bold',
              },
            };
          })
          .filter(Boolean);
        if (styleReqs.length > 0) {
          await docsBatchUpdate(token, documentId, styleReqs);
        }
      }
    } else {
      console.warn(
        `[create-google-doc] cell count mismatch: ${cellIndices.length} cells vs ${flatText.length} values — skipping fill`,
      );
    }

    // ── 5. Share with the reader ─────────────────────────────────────────────
    let shared = false;
    if (shareEmail) {
      const permRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${documentId}/permissions?sendNotificationEmail=true&emailMessage=${encodeURIComponent('Here is the latest blood pressure log.')}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: shareEmail }),
        },
      );
      if (permRes.ok) shared = true;
      else console.warn('[create-google-doc] share failed:', permRes.status, await permRes.text());
    }

    return jsonResponse({
      ok: true,
      doc_url: `https://docs.google.com/document/d/${documentId}/edit`,
      rows: rows.length,
      shared,
    });
  } catch (err) {
    console.error('[create-google-doc] error:', err);
    return jsonResponse({ error: 'export_failed', detail: (err as Error)?.message }, 500);
  }
});
