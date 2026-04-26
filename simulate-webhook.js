// ═══════════════════════════════════════════════════════════════
// BBF VAULT — Engine Simulator
// Fires a mock client payload at the local /process endpoint.
// Usage: node simulate-webhook.js
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const PORT = process.env.PORT || 3000;
const ENDPOINT = `http://localhost:${PORT}/process`;

const payload = {
  client_name: 'Akeem Brown',
  vault_email: 'test-vault@buildbelievefit.com',
  age: 32,
  height_weight: "5'10\", 175 lbs",
  clinical_history: 'No current musculoskeletal issues. Cleared for high-intensity participation.',
  training_protocol: 'Hypertrophy focus, 85% 1RM working loads.',
  liability_cleared: true,
};

(async () => {
  console.log(`[SIMULATOR] Firing mock client payload at ${ENDPOINT}`);
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
