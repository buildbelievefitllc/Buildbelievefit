// ═══════════════════════════════════════════════════════════════
// BBF VAULT — Tally → Supabase → Anthropic → Notion Pipeline
// Build Believe Fit LLC | Central Automation Brain
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { Client: NotionClient } = require('@notionhq/client');
const Anthropic = require('@anthropic-ai/sdk');

// ───────────────────────────────────────────────────────────────
// Environment validation
// ───────────────────────────────────────────────────────────────
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  NOTION_API_KEY,
  NOTION_DATABASE_ID,
  ANTHROPIC_API_KEY,
  PORT = 3000,
} = process.env;

const REQUIRED_ENV = {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  NOTION_API_KEY,
  NOTION_DATABASE_ID,
  ANTHROPIC_API_KEY,
};

const missingEnv = Object.entries(REQUIRED_ENV)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingEnv.length) {
  console.error('[BBF VAULT] Missing required environment variables:', missingEnv.join(', '));
  console.error('[BBF VAULT] Copy .env.example to .env and populate it before launching.');
}

// ───────────────────────────────────────────────────────────────
// Service clients
// ───────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

const notion = new NotionClient({ auth: NOTION_API_KEY });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

// ───────────────────────────────────────────────────────────────
// System prompts (DO NOT MODIFY — locked by directive)
// ───────────────────────────────────────────────────────────────
const SYSTEM_PROMPT_HYPERTROPHY =
  'You are an elite, clinical AI Fitness Architect for Build Believe Fit LLC. Generate a highly structured, periodized hypertrophy and prehab training protocol in strict Markdown. Rules: 1. All primary hypertrophy lifts must be calculated around an 85% 1RM working load. 2. Focus strictly on hypertrophy and body composition. 3. If the clinical history indicates joint issues, prescribe 2-3 specific pre-habilitation movements prior to working sets. 4. Use deadpan, authoritative, clinical language.';

const SYSTEM_PROMPT_NUTRITION =
  'You are an elite Clinical Nutritionist for Build Believe Fit LLC. Generate a precise nutritional blueprint in strict Markdown. Rules: 1. Program meals entirely around a sustainable 12/12 intermittent fasting schedule (8:00 AM to 8:00 PM). 2. Construct meal plans utilizing clean whole foods (chicken breast, steak, jasmine rice, sweet potatoes, broccoli, asparagus). 3. Calculate estimated TDEE, subtract a safe clinical deficit for fat loss while maintaining hypertrophy, and output exact macro targets. 4. Present the output in a Markdown table showing the exact time of consumption, food source, and macro breakdown.';

// ───────────────────────────────────────────────────────────────
// Tally payload extractor
// Tally posts data as { data: { fields: [{ label/key, value }, ...] } }
// We tolerate both flat JSON and the canonical Tally envelope.
// ───────────────────────────────────────────────────────────────
function extractTallyPayload(body) {
  const flat = {};
  
  // Phase 1: Flatten the payload completely
  if (body && body.data && Array.isArray(body.data.fields)) {
    for (const field of body.data.fields) {
      // Strip all spaces and punctuation so "Vault Email Address*" becomes "vaultemailaddress"
      const label = (field.label || field.key || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
      flat[label] = field.value;
    }
  } else {
    // Fallback for local simulator
    for (const [k, v] of Object.entries(body || {})) {
      const key = k.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
      flat[key] = v;
    }
  }

  // Phase 2: Aggressive Fuzzy Matcher
  const get = (keywords) => {
    for (const [label, value] of Object.entries(flat)) {
      for (const kw of keywords) {
        const kwNorm = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (label.includes(kwNorm) && value) {
          return Array.isArray(value) ? value.join(', ') : value;
        }
      }
    }
    return '';
  };

  return {
    client_name: String(get(['name']) || 'Unknown Client'),
    vault_email: String(get(['email'])),
    age: String(get(['age', 'old'])),
    height_weight: String(get(['height', 'weight'])),
    clinical_history: String(get(['clinical', 'history', 'injuries', 'medical', 'background'])),
    training_protocol: String(get(['protocol', 'training', 'goal', 'objective'])),
    liability_cleared: true // Auto-clear upon form submission
  };
}

// ───────────────────────────────────────────────────────────────
// PHASE 1 — Catch & Store (Supabase upsert)
// ───────────────────────────────────────────────────────────────
async function upsertActiveClient(payload) {
  const ageNumeric = Number.isFinite(Number(payload.age)) ? Number(payload.age) : null;

  const row = {
    client_name: payload.client_name,
    vault_email: payload.vault_email,
    age: ageNumeric,
    height_weight: payload.height_weight,
    clinical_history: payload.clinical_history,
    training_protocol: payload.training_protocol,
    liability_cleared: payload.liability_cleared,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('bbf_active_clients')
    .upsert(row, { onConflict: 'vault_email' })
    .select()
    .single();

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  return data;
}

// ───────────────────────────────────────────────────────────────
// PHASE 2 — Anthropic generation engine (parallel)
// ───────────────────────────────────────────────────────────────
async function generateHypertrophyBlueprint(payload) {
  const userMessage = [
    `Client Age: ${payload.age || 'N/A'}`,
    `Clinical History: ${payload.clinical_history || 'None reported'}`,
    `Current Training Protocol: ${payload.training_protocol || 'None reported'}`,
    '',
    'Generate the periodized hypertrophy and prehab training protocol now.',
  ].join('\n');

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT_HYPERTROPHY,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

async function generateFuelMatrix(payload) {
  const userMessage = [
    `Client Age: ${payload.age || 'N/A'}`,
    `Height & Weight: ${payload.height_weight || 'N/A'}`,
    '',
    'Generate the Sovereign Fuel Matrix nutritional blueprint now.',
  ].join('\n');

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT_NUTRITION,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

// ───────────────────────────────────────────────────────────────
// Markdown → Notion blocks (lightweight converter)
// Splits on blank lines; routes headings, tables, bullets, code,
// and paragraphs into the appropriate Notion block types.
// ───────────────────────────────────────────────────────────────
function richText(content) {
  if (!content) return [];
  const text = String(content).slice(0, 1900);
  return [{ type: 'text', text: { content: text } }];
}

function markdownToNotionBlocks(markdown) {
  if (!markdown) return [];
  const lines = String(markdown).split('\n');
  const blocks = [];
  let i = 0;

  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
  const isTableSeparator = (line) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line);

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const type = level === 1 ? 'heading_1' : level === 2 ? 'heading_2' : 'heading_3';
      blocks.push({ object: 'block', type, [type]: { rich_text: richText(h[2]) } });
      i++;
      continue;
    }

    // Code fences
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim() || 'plain text';
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({
        object: 'block',
        type: 'code',
        code: { rich_text: richText(codeLines.join('\n')), language: lang },
      });
      continue;
    }

    // Tables
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim());
      i += 2; // skip header + separator
      const rows = [headerCells];
      while (i < lines.length && isTableRow(lines[i])) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim());
        // pad / trim to header width
        while (cells.length < headerCells.length) cells.push('');
        rows.push(cells.slice(0, headerCells.length));
        i++;
      }
      blocks.push({
        object: 'block',
        type: 'table',
        table: {
          table_width: headerCells.length,
          has_column_header: true,
          has_row_header: false,
          children: rows.map((cells) => ({
            object: 'block',
            type: 'table_row',
            table_row: { cells: cells.map((c) => richText(c)) },
          })),
        },
      });
      continue;
    }

    // Bulleted list
    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, '');
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: richText(text) },
      });
      i++;
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const text = line.replace(/^\s*\d+\.\s+/, '');
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: richText(text) },
      });
      i++;
      continue;
    }

    // Paragraph (collapse soft-wrapped lines until blank)
    const paragraph = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#|```|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(lines[i])) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: richText(paragraph.join(' ')) },
    });
  }

  return blocks;
}

// ───────────────────────────────────────────────────────────────
// PHASE 3 — Notion vault push
// ───────────────────────────────────────────────────────────────
async function pushToNotionVault(payload, hypertrophyMarkdown, fuelMarkdown) {
  const properties = {
    'Client Name': {
      title: [{ type: 'text', text: { content: payload.client_name || 'Unnamed Client' } }],
    },
    'Vault Email Address': {
      email: payload.vault_email || null,
    },
    Age: {
      number: Number.isFinite(Number(payload.age)) ? Number(payload.age) : null,
    },
    'Height & Weight': {
      rich_text: richText(payload.height_weight),
    },
    'Clinical History': {
      rich_text: richText(payload.clinical_history),
    },
    'Training Protocol': {
      rich_text: richText(payload.training_protocol),
    },
    'Liability Cleared': {
      checkbox: Boolean(payload.liability_cleared),
    },
  };

  const children = [
    {
      object: 'block',
      type: 'heading_1',
      heading_1: { rich_text: richText('Hypertrophy Blueprint') },
    },
    ...markdownToNotionBlocks(hypertrophyMarkdown),
    {
      object: 'block',
      type: 'divider',
      divider: {},
    },
    {
      object: 'block',
      type: 'heading_1',
      heading_1: { rich_text: richText('Sovereign Fuel Matrix') },
    },
    ...markdownToNotionBlocks(fuelMarkdown),
  ];

  // Notion limits children per request to 100; send first 100 inline,
  // append remainder via blocks.children.append.
  const inlineChildren = children.slice(0, 100);
  const remainingChildren = children.slice(100);

  const page = await notion.pages.create({
    parent: { database_id: NOTION_DATABASE_ID },
    properties,
    children: inlineChildren,
  });

  for (let offset = 0; offset < remainingChildren.length; offset += 100) {
    const chunk = remainingChildren.slice(offset, offset + 100);
    await notion.blocks.children.append({ block_id: page.id, children: chunk });
  }

  return page;
}

// ───────────────────────────────────────────────────────────────
// Express server
// ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'bbf-vault-webhook', model: ANTHROPIC_MODEL });
});

app.post('/webhook/tally', async (req, res) => {
  const startedAt = Date.now();
  let payload;

  try {
    payload = extractTallyPayload(req.body || {});
    console.log('[BBF VAULT] Inbound Tally payload:', {
      client_name: payload.client_name,
      vault_email: payload.vault_email,
      liability_cleared: payload.liability_cleared,
    });
  } catch (err) {
    console.error('[BBF VAULT] Payload extraction failed:', err);
    return res.status(400).json({ ok: false, error: 'Invalid Tally payload' });
  }

  if (!payload.vault_email) {
    console.error('[BBF VAULT] Missing vault_email — aborting pipeline.');
    return res.status(400).json({ ok: false, error: 'vault_email is required' });
  }

  // Phase 1 — Supabase upsert
  let supabaseRow = null;
  try {
    supabaseRow = await upsertActiveClient(payload);
    console.log('[BBF VAULT] Phase 1 complete — Supabase row upserted for', payload.vault_email);
  } catch (err) {
    console.error('[BBF VAULT] Phase 1 (Supabase) failed:', err);
    return res.status(500).json({ ok: false, phase: 'supabase', error: err.message });
  }

  // Phase 2 — parallel Anthropic generation
  let hypertrophyMarkdown = '';
  let fuelMarkdown = '';
  try {
    [hypertrophyMarkdown, fuelMarkdown] = await Promise.all([
      generateHypertrophyBlueprint(payload),
      generateFuelMatrix(payload),
    ]);
    console.log('[BBF VAULT] Phase 2 complete — Anthropic generation finished.');
  } catch (err) {
    console.error('[BBF VAULT] Phase 2 (Anthropic) failed:', err);
    return res.status(502).json({ ok: false, phase: 'anthropic', error: err.message });
  }

  // Phase 3 — Notion vault push
  let notionPage = null;
  try {
    notionPage = await pushToNotionVault(payload, hypertrophyMarkdown, fuelMarkdown);
    console.log('[BBF VAULT] Phase 3 complete — Notion page created:', notionPage.id);
  } catch (err) {
    console.error('[BBF VAULT] Phase 3 (Notion) failed:', err);
    return res.status(502).json({ ok: false, phase: 'notion', error: err.message });
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[BBF VAULT] Pipeline complete in ${elapsedMs}ms for ${payload.vault_email}`);

  return res.status(200).json({
    ok: true,
    elapsed_ms: elapsedMs,
    supabase_id: supabaseRow ? supabaseRow.id || null : null,
    notion_page_id: notionPage ? notionPage.id : null,
  });
});

// Global fallthrough error handler
app.use((err, req, res, next) => {
  console.error('[BBF VAULT] Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[BBF VAULT] Webhook server listening on port ${PORT}`);
  console.log(`[BBF VAULT] Tally endpoint: POST /webhook/tally`);
});

module.exports = app;
