-- ============================================================================
-- BBF VAPI VOICE INTEGRATION - PHASE 1.6
-- Description: Wire pg_net outbound call to the edge function with Vault auth.
-- Reference: Big Jim Directive #4
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bbf_evaluate_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    slip_record RECORD;
    days_missed INTEGER;
    invoke_token TEXT;
BEGIN
    -- Retrieve the webhook invoke token from Supabase Vault
    SELECT decrypted_secret INTO invoke_token
    FROM vault.decrypted_secrets 
    WHERE name = 'bbf_vapi_invoke_token' 
    LIMIT 1;

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
                BEGIN
                    PERFORM net.http_post(
                        url := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/vapi-outbound-trigger',
                        headers := jsonb_build_object(
                            'Content-Type', 'application/json',
                            'X-BBF-Token', COALESCE(invoke_token, '')
                        ),
                        body := jsonb_build_object(
                            'client_email', slip_record.client_email, 
                            'client_name', slip_record.client_name,
                            'client_phone', slip_record.client_phone,
                            'days_missed', days_missed, 
                            'protocol', slip_record.training_protocol
                        )
                    );
                EXCEPTION WHEN OTHERS THEN
                    -- A failed HTTP post won't roll back the vapi_calls insert
                    -- We just swallow the error so it continues to the next client
                END;
            END IF;
        END IF;
    END LOOP;
END;
$$;
