// Follows Deno edge function architecture.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const BBF_VAPI_INVOKE_TOKEN = Deno.env.get('BBF_VAPI_INVOKE_TOKEN');
    if (!BBF_VAPI_INVOKE_TOKEN) {
      return new Response(
        JSON.stringify({ ok: false, error: "vapi_not_configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }

    const incomingToken = req.headers.get('x-bbf-token');
    if (incomingToken !== BBF_VAPI_INVOKE_TOKEN) {
      return new Response(
        JSON.stringify({ ok: false, error: "unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
    const VAPI_ASSISTANT_ID = Deno.env.get('VAPI_ASSISTANT_ID');                    // accountability (Rex)
    const VAPI_SALES_ASSISTANT_ID = Deno.env.get('VAPI_SALES_ASSISTANT_ID');         // sales recovery
    const VAPI_PHONE_NUMBER_ID = Deno.env.get('VAPI_PHONE_NUMBER_ID');

    if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !VAPI_SALES_ASSISTANT_ID || !VAPI_PHONE_NUMBER_ID) {
      throw new Error("Missing Vapi configuration environment variables");
    }

    const {
      use_case = 'accountability',  // default for safety / backwards compat with any caller that still sends old shape
      client_email,
      client_name,
      client_phone,
      days,
      days_missed,                  // legacy field name — accept for one deploy cycle in case migration order slips
      protocol
    } = await req.json();

    if (!client_phone) {
      throw new Error(`Cannot initiate call for ${client_email}: No phone number provided.`);
    }

    if (!['accountability', 'sales_recovery'].includes(use_case)) {
      throw new Error(`Unknown use_case: ${use_case}`);
    }

    const effectiveDays = days ?? days_missed ?? 3;
    const assistantId = use_case === 'sales_recovery' ? VAPI_SALES_ASSISTANT_ID : VAPI_ASSISTANT_ID;
    const variableValues = use_case === 'sales_recovery'
      ? {
          clientName: client_name || 'Client',
          daysSincePathfinder: String(effectiveDays),
          programFocus: protocol || 'Training Protocol',
          coachName: 'Akeem'
        }
      : {
          clientName: client_name || 'Client',
          daysMissed: String(effectiveDays),
          programFocus: protocol || 'Training Protocol',
          coachName: 'Akeem'
        };

    const vapiPayload = {
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: { number: client_phone },
      assistantId,
      assistantOverrides: { variableValues }
    };

    console.log(`Initiating Vapi outbound call to ${client_name} (${client_phone})...`);

    // Fire request to Vapi
    const vapiRes = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vapiPayload)
    });

    if (!vapiRes.ok) {
      const errorText = await vapiRes.text();
      throw new Error(`Vapi API responded with status ${vapiRes.status}: ${errorText}`);
    }

    const responseData = await vapiRes.json();
    console.log("Vapi call initiated successfully", responseData);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: 'Vapi call triggered successfully',
        data: responseData 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error triggering Vapi call:", error.message);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    );
  }
});
