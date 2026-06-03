# Brevo Welcome-Email Migration — Environment & Dependency Map

**Status:** Comms-prep mapping (Phase 8 deck-clearing). No code cutover in this pass — this
document maps exactly what the welcome-email migration to Brevo requires so the cutover is a
configuration exercise, not a discovery one.

> Source of truth for the copy: [`api/day0-welcome-emails.json`](./day0-welcome-emails.json)
> (trilingual EN/ES/PT, three tiers). Documented flow: [`api/webhook-schema.json`](./webhook-schema.json).
> Related backlog: `AG_INTEGRATION_NOTES.md` P3 ("Welcome email polish") + the Ghost Automation Zap note.

---

## 1 · Current state vs target

| | Current (live) | Target (this migration) |
|---|---|---|
| **Server-side path** | `supabase/functions/stripe-webhook` fires a Brevo email via raw REST (`POST api.brevo.com/v3/smtp/email`) with **inline `htmlContent`**, **English-only**, username + **plaintext PIN** + tier. | Same fire point, but using **Brevo-managed transactional templates** (`templateId` + `params`), **trilingual** per `day0-welcome-emails.json`, language-selected. |
| **Legacy path** | "BBF Ghost Automation" **Zapier** Zap: Stripe → Zapier → **Gmail** step sends a basic HTML welcome with credentials via merge tags. | **Decommission** the Gmail step (avoid double-send) once the server-side template path is verified. |
| **Lead path (reference)** | `bbf-lead-capture` already uses the same Brevo REST pattern for the nutrition-lite welcome + admin notify — the proven integration to mirror. | Unchanged (already Brevo). |

The integration mechanism (raw `fetch` to the Brevo v3 REST API) **already exists and works** in two
functions. The migration is therefore primarily: (a) build templates in the Brevo dashboard, (b) add
the template-id env vars, (c) switch the stripe-webhook send from `htmlContent` → `templateId`+`params`,
(d) retire the Zapier Gmail step.

---

## 2 · Environment variables

### Already in place (Supabase Edge secrets — reused, no change)
| Var | Used by | Purpose | Default in code |
|---|---|---|---|
| `BREVO_API_KEY` | `stripe-webhook`, `bbf-lead-capture` | Brevo transactional API key (`api-key` header). **Secret.** | — (send skipped if unset) |
| `BREVO_FROM_EMAIL` | both | Verified sender address | `buildbelievefitllc@buildbelievefit.fitness` |
| `BREVO_FROM_NAME` | both | Sender display name | `Build Believe Fit` |
| `ADMIN_LEAD_NOTIFY_EMAIL` | `bbf-lead-capture` | Admin notification inbox | `buildbelievefitllc@buildbelievefit.fitness` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | both | Provisioning/DB writes (auto-injected) | — |
| `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Verify + read the checkout event that triggers the welcome | — |

### NEW — required for the template cutover (set via `supabase secrets set … --project-ref ihclbceghxpuawymlvgi`)
| Var | Purpose | Notes |
|---|---|---|
| `BREVO_WELCOME_TEMPLATE_EN` | Brevo transactional **template id** (integer) for the English Day-0 welcome | One per language; created in Brevo dashboard from `day0-welcome-emails.json`. |
| `BREVO_WELCOME_TEMPLATE_ES` | Spanish template id | |
| `BREVO_WELCOME_TEMPLATE_PT` | Portuguese (pt-BR) template id | |
| `BREVO_UPDATE_TEMPLATE_EN` *(optional)* | Template id for the **non-new-user** "subscription updated" email | Mirrors the current `newlyProvisioned ? welcome : update` branch; can stay inline if templating only the welcome. |

> Tier-specific copy (`community` / `elite` / `legacy` in the JSON) can be handled **either** as
> separate template ids **or** as one template with a `TIER` param driving conditional blocks. Recommended:
> one template per **language**, with `TIER` as a param (fewer ids to manage). Adjust the var list if the
> team prefers per-tier templates.

---

## 3 · Dependencies (non-code)

These are **dashboard / DNS / account** dependencies, not npm/Deno packages — the code path is raw
`fetch`, so **no SDK dependency is added** (no `@getbrevo/brevo`, no `sib-api-v3-sdk`).

1. **Brevo account + transactional plan** with API key (transactional `send` scope).
2. **Verified sender domain** `buildbelievefit.fitness` in Brevo: **SPF**, **DKIM**, and a **DMARC**
   record on the DNS zone. Without domain auth the welcome lands in spam — the single biggest
   deliverability dependency.
3. **Transactional templates** created in the Brevo dashboard, content imported from
   `api/day0-welcome-emails.json`, using Brevo param syntax: `{{params.FIRSTNAME}}`,
   `{{params.USERNAME}}`, `{{params.PIN}}`, `{{params.TIER}}` (and `{{params.LANGUAGE}}` if used).
4. **(If keeping Zapier in the loop)** Zapier dashboard access to swap the Gmail step → Brevo
   "Send transactional email (template)" step. **(If going server-side only)** no Zapier dependency —
   `stripe-webhook` fires directly.

---

## 4 · Personalization data — where each param comes from

All personalization is available **server-side at the moment of fulfillment** in `stripe-webhook`
(no extra fetch needed):

| Brevo param | Source |
|---|---|
| `FIRSTNAME` | `fullName.split(' ')[0]` (from Stripe `customer_name`) |
| `USERNAME` | `bbf_stripe_fulfillment_transaction` → `txn.username` (provisioned slug) |
| `PIN` | `generatePin()` in `stripe-webhook` (passed into the provision RPC) — **plaintext** |
| `TIER` | resolved `tier` (Stripe `metadata.tier` / `client_reference_id`, allowlisted) |
| `LANGUAGE` | Stripe `metadata.language` if present, else default `en` → selects the template id |
| `to.email` / `to.name` | Stripe `customer_email` / `customer_name` |

> The legacy Zapier path instead pulls `USERNAME`/`PIN` from the Render **`/provision`** endpoint
> (`index.js`, `POST /provision`). The server-side path already has these in-process, which is why the
> direct-from-webhook cutover is cleaner and removes Zapier as a moving part.

---

## 5 · Security boundaries (carry forward)

- **Plaintext PIN:** the welcome email is the one place the PIN appears in cleartext. Never log it,
  never forward it to analytics/third parties, never put it in Brevo **tags** or contact attributes.
  Keep it strictly in the template `params` payload.
- **API key:** `BREVO_API_KEY` lives only in Supabase Edge secrets — never in the client bundle, repo,
  or commit. (Same boundary as `bbf-lead-capture`.)
- **Non-blocking send:** keep the existing pattern — a Brevo failure must NOT fail fulfillment (the
  Stripe transaction already committed atomically). Send stays wrapped in try/catch, best-effort.
- **No double-send:** decommission the Zapier Gmail welcome the same deploy the template path goes
  live, or gate one off, so a buyer never gets two welcomes.

---

## 6 · Cutover checklist (for the implementation pass — not done here)

- [ ] Brevo: verify `buildbelievefit.fitness` sender domain (SPF/DKIM/DMARC).
- [ ] Brevo: create EN/ES/PT transactional templates from `day0-welcome-emails.json`; capture template ids.
- [ ] `supabase secrets set BREVO_WELCOME_TEMPLATE_EN|ES|PT=… --project-ref ihclbceghxpuawymlvgi`.
- [ ] `stripe-webhook`: switch the welcome branch from `htmlContent` → `{ templateId, params }`, language-selected.
- [ ] Send a Stripe **test-mode** checkout → confirm the trilingual template renders with correct USERNAME/PIN/TIER.
- [ ] Disable the Zapier Gmail welcome step.
- [ ] Reconcile tier drift: `webhook-schema.json` documents an **older** tier model (gateway $147 /
      architect $497 / sovereign $1500) that does **not** match the current Stripe pricing matrix
      (`frontend/src/lib/pricingMatrix.js`). Align the template `TIER` copy with live SKUs before launch.

---

*Prepared as Phase 8 comms-prep. Mapping only — environment variables and dependencies above; the
template build + send switch are the implementation pass.*
