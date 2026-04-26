// ═══════════════════════════════════════════════════════════════
// BBF VAULT — Tally Webhook Simulator
// Fires a mock Tally payload at the local /webhook/tally endpoint.
// Usage: node simulate-webhook.js
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const PORT = process.env.PORT || 3000;
const ENDPOINT = `http://localhost:${PORT}/webhook/tally`;

const payload = {
  data: {
    fields: [
      { key: 'client_name', label: 'Client Name', value: 'Akeem Brown' },
      { key: 'vault_email', label: 'Vault Email Address', value: 'test-vault@buildbelievefit.com' },
      { key: 'age', label: 'Age', value: 32 },
      { key: 'height_weight', label: 'Height & Weight', value: "5'10\", 175 lbs" },
      {
        key: 'clinical_history',
        label: 'Clinical History',
        value: 'No current musculoskeletal issues. Cleared for high-intensity participation.',
      },
      {
        key: 'training_protocol',
        label: 'Training Protocol',
        value: 'Hypertrophy focus, 85% 1RM working loads.',
      },
      { key: 'liability_cleared', label: 'Liability Cleared', value: true },
    ],
  },
};

(async () => {
  console.log(`[SIMULATOR] Firing mock Tally payload at ${ENDPOINT}`);
  console.log('[SIMULATOR] Payload:', JSON.stringify(payload, null, 2));

  const startedAt = Date.now();
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const elapsedMs = Date.now() - startedAt;
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    console.log(`[SIMULATOR] HTTP ${response.status} ${response.statusText} (${elapsedMs}ms)`);
    console.log('[SIMULATOR] Response body:', parsed);

    if (response.ok) {
      console.log('[SIMULATOR] ✓ Pipeline completed successfully.');
      process.exit(0);
    } else {
      console.log('[SIMULATOR] ✗ Pipeline returned non-2xx — see server logs for phase trace.');
      process.exit(1);
    }
  } catch (err) {
    console.error('[SIMULATOR] Network/transport error:', err.message);
    process.exit(2);
  }
})();
