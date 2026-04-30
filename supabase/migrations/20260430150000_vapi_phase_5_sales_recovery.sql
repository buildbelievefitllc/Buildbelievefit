-- ============================================================================
-- BBF VAPI VOICE INTEGRATION - PHASE 5
-- Description: Sales recovery outbound call loop (Pathfinder closer)
-- Reference: Big Jim Directive #4 / Phase 5 Addendum
-- ============================================================================

-- 1. Add use_case to tracking table
ALTER TABLE public.bbf_vapi_calls
  ADD COLUMN IF NOT EXISTS use_case TEXT NOT NULL DEFAULT 'accountability'
    CHECK (use_case IN ('accountability', 'sales_recovery'));

-- 2. Update bbf_evaluate_streaks() to tag use_case
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
                AND vc.use_case = 'accountability'
                AND vc.called_at > now() - INTERVAL '7 days'
            ) THEN
                -- 1. Log the initiation of the call
                INSERT INTO public.bbf_vapi_calls (client_email, call_status, use_case)
                VALUES (slip_record.client_email, 'initiated', 'accountability');

                -- 2. Invoke the Supabase Edge Function using pg_net (async webhook)
                BEGIN
                    PERFORM net.http_post(
                        url := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/vapi-outbound-trigger',
                        headers := jsonb_build_object(
                            'Content-Type', 'application/json',
                            'X-BBF-Token', COALESCE(invoke_token, '')
                        ),
                        body := jsonb_build_object(
                            'use_case', 'accountability',
                            'client_email', slip_record.client_email, 
                            'client_name', slip_record.client_name,
                            'client_phone', slip_record.client_phone,
                            'days', days_missed, 
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

-- 3. Create bbf_evaluate_abandoned_carts()
CREATE OR REPLACE FUNCTION public.bbf_evaluate_abandoned_carts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    cart_record RECORD;
    days_since_pathfinder INTEGER;
    invoke_token TEXT;
BEGIN
    SELECT decrypted_secret INTO invoke_token
    FROM vault.decrypted_secrets
    WHERE name = 'bbf_vapi_invoke_token'
    LIMIT 1;

    FOR cart_record IN
        WITH call_history AS (
            SELECT
                client_email,
                COUNT(*) FILTER (WHERE use_case = 'sales_recovery') AS sales_call_count,
                MAX(called_at) FILTER (WHERE use_case = 'sales_recovery') AS last_sales_called_at
            FROM public.bbf_vapi_calls
            WHERE called_at > now() - INTERVAL '30 days'
            GROUP BY client_email
        )
        SELECT
            ac.client_email,
            ac.client_name,
            ac.client_phone,
            ac.training_protocol,
            ac.created_at,
            EXTRACT(DAY FROM (now() - ac.created_at))::int AS days_since
        FROM public.bbf_active_clients ac
        LEFT JOIN public.bbf_users u ON ac.client_email = u.email
        LEFT JOIN call_history ch ON ac.client_email = ch.client_email
        WHERE ac.onboarding_status = 'Pending'
          AND ac.client_phone IS NOT NULL
          AND u.id IS NULL  -- not yet paid (no matching bbf_users row)
          AND ac.created_at < now() - INTERVAL '3 days'   -- abandoned threshold
          AND ac.created_at > now() - INTERVAL '30 days'  -- hard stop
          AND (
              ch.sales_call_count IS NULL                                            -- never called
              OR (ch.sales_call_count = 1 AND ch.last_sales_called_at < now() - INTERVAL '7 days')  -- 1 prior + 7d follow-up window
          )
    LOOP
        days_since_pathfinder := cart_record.days_since;

        INSERT INTO public.bbf_vapi_calls (client_email, call_status, use_case)
        VALUES (cart_record.client_email, 'initiated', 'sales_recovery');

        BEGIN
            PERFORM net.http_post(
                url := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/vapi-outbound-trigger',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'X-BBF-Token', COALESCE(invoke_token, '')
                ),
                body := jsonb_build_object(
                    'use_case', 'sales_recovery',
                    'client_email', cart_record.client_email,
                    'client_name', cart_record.client_name,
                    'client_phone', cart_record.client_phone,
                    'days', days_since_pathfinder,
                    'protocol', cart_record.training_protocol
                )
            );
        EXCEPTION WHEN OTHERS THEN
            -- Mirror bbf_evaluate_streaks: swallow HTTP errors so loop continues
        END;
    END LOOP;
END;
$function$;

-- 4. Schedule cron job
SELECT cron.schedule(
    'vapi-daily-abandoned-cart-check',
    '0 19 * * *',
    $$ SELECT public.bbf_evaluate_abandoned_carts() $$
);
