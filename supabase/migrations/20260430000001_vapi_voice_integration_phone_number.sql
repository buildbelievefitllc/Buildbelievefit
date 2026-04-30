-- ============================================================================
-- BBF VAPI VOICE INTEGRATION - PHASE 1.5
-- Description: Add client_phone to active clients to support outbound calls.
-- Reference: Big Jim Directive #4
-- ============================================================================

-- Add phone column
ALTER TABLE public.bbf_active_clients ADD COLUMN IF NOT EXISTS client_phone TEXT;

-- Update the evaluation function to include client_phone
CREATE OR REPLACE FUNCTION public.bbf_evaluate_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    slip_record RECORD;
    days_missed INTEGER;
BEGIN
    FOR slip_record IN
        SELECT 
            ac.client_email,
            ac.client_name,
            ac.client_phone,
            ac.training_protocol,
            u.id as user_id,
            (SELECT max(date) FROM public.bbf_logs l WHERE l.user_id = u.id) as last_log_date
        FROM public.bbf_active_clients ac
        JOIN public.bbf_users u ON ac.client_email = u.email
        WHERE ac.onboarding_status != 'Pending' AND ac.client_phone IS NOT NULL
    LOOP
        -- Calculate days missed. If never logged, assume 3+ for triggering.
        IF slip_record.last_log_date IS NULL THEN
            days_missed := 3;
        ELSE
            days_missed := CURRENT_DATE - slip_record.last_log_date;
        END IF;

        IF days_missed >= 3 THEN
            -- Check rate limit: Has this client been called in the last 7 days?
            IF NOT EXISTS (
                SELECT 1 FROM public.bbf_vapi_calls vc 
                WHERE vc.client_email = slip_record.client_email 
                AND vc.called_at > now() - INTERVAL '7 days'
            ) THEN
                -- 1. Log the initiation of the call
                INSERT INTO public.bbf_vapi_calls (client_email, call_status)
                VALUES (slip_record.client_email, 'initiated');

                -- 2. Invoke the Supabase Edge Function using pg_net (async webhook)
                -- NOTE: pg_net extension must be enabled. The actual URL and anon key 
                -- are placeholders to be configured with Vault in Phase 2.
                /*
                PERFORM net.http_post(
                    url := 'https://localhost/functions/v1/vapi-outbound-trigger',
                    headers := '{"Content-Type": "application/json"}'::jsonb,
                    body := jsonb_build_object(
                        'client_email', slip_record.client_email, 
                        'client_name', slip_record.client_name,
                        'client_phone', slip_record.client_phone,
                        'days_missed', days_missed, 
                        'protocol', slip_record.training_protocol
                    )
                );
                */
            END IF;
        END IF;
    END LOOP;
END;
$$;
