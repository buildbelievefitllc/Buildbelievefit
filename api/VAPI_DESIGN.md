# Vapi Voice Integration (Big Jim Directive #4)

## Overview
This design document outlines the architecture and implementation phases for integrating Vapi to perform outbound accountability voice calls to BBF Sovereign clients. The goal is to act as an automated "Big Jim" accountability coach, detecting when a client misses their logged activity streak and triggering an AI voice call to get them back on track.

## 1. Trigger Conditions
The system must proactively identify clients who need an intervention. We will define "slipping" as:
- **Missed Streak**: No entries in `bbf_client_logs` for a continuous 3-day period (72 hours).
- **Condition**: Client must be in the `bbf_active_clients` table (active status).
- **Rate Limiting**: A client cannot receive more than one accountability call per 7-day period to avoid spam.

## 2. Architecture & Webhook Flow
Instead of triggering purely off a row event (which requires a log to *happen*), the absence of logs over time requires a scheduled check. 
The architecture will use **Supabase pg_cron** to run a daily evaluation.

**Data Flow:**
1. **Scheduled Job**: `pg_cron` runs every day at 10:00 AM MST.
2. **Evaluation Function**: A PostgreSQL function evaluates `bbf_active_clients` against the most recent entry in `bbf_client_logs`.
3. **Trigger**: For every client that meets the "Missed Streak" condition (and hasn't been called in 7 days), the function invokes a **Supabase Edge Function** (`vapi-outbound-trigger`).
4. **Edge Function**: Formats the Vapi payload and posts to the Vapi outbound call endpoint (`POST https://api.vapi.ai/call/phone`).

## 3. Webhook Payload Spec
When the Edge Function calls the Vapi API, it provides dynamic context about the client to ground the AI's conversation.

**Vapi Outbound Request Payload:**
```json
{
  "phoneNumber": {
    "twilioPhoneNumber": "+1<BBF_TWILIO_NUMBER>",
    "phoneNumber": "+1<CLIENT_PHONE_NUMBER>"
  },
  "assistantId": "<VAPI_ASSISTANT_ID>",
  "assistantOverrides": {
    "variableValues": {
      "clientName": "Marcus",
      "daysMissed": "3",
      "programFocus": "Hypertrophy",
      "coachName": "Akeem"
    }
  }
}
```

## 4. Vapi Configuration
**Assistant Settings:**
- **Voice**: A commanding, authoritative, yet encouraging voice (e.g., ElevenLabs "Marcus" or custom clone if provided).
- **First Message**: "Yo, {clientName}. It's the Sovereign Vault AI calling on behalf of Coach Akeem. You've missed the last {daysMissed} days of your {programFocus} protocol. What's the friction?"
- **System Prompt**: 
  *You are the BBF Sovereign Accountability AI. Your job is to act as an aggressive but supportive performance auditor. You represent Coach Akeem. The client has fallen behind on their training logs. Your goal is to identify the friction (time, injury, motivation) and get a verbal commitment from them to complete a session today. Do not give medical advice. Keep the conversation concise and action-oriented.*

## 5. Database Schema Additions
To enforce the 7-day rate limit, we need to track outbound calls.

**New Table: `bbf_vapi_calls`**
- `id` (uuid, pk)
- `client_email` (text, fk to bbf_active_clients)
- `called_at` (timestamptz, default now())
- `call_status` (text)
- `vapi_call_id` (text, from API response)
- `transcript` (text, optional for later Webhook ingest)

## 6. Implementation Sequence (3 PRs)

### PR 1: Schema & State Tracking
- Create `bbf_vapi_calls` table and enforce RLS.
- Create the PostgreSQL evaluation function (`bbf_evaluate_streaks()`) to identify slipping clients based on `bbf_client_logs` and `bbf_vapi_calls`.

### PR 2: Supabase Edge Function (`vapi-outbound-trigger`)
- Create the Edge Function using Deno.
- Securely fetch the Vapi API key from Supabase Vault/Secrets.
- Implement the `POST` request to `api.vapi.ai/call/phone` mapping the `variableValues`.

### PR 3: Scheduling & Vapi Assistant Configuration
- Setup `pg_cron` inside `api/supabase-schema.sql` (or via Dashboard if pg_cron is restricted to superuser).
- Provision the Vapi Assistant in the Vapi dashboard.
- Tie the pg_cron job to invoke the Edge Function via `pg_net` or `http_request`.
