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
    const VAPI_ASSISTANT_ID = Deno.env.get('VAPI_ASSISTANT_ID');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !TWILIO_PHONE_NUMBER) {
      throw new Error("Missing Vapi or Twilio configuration environment variables");
    }

    // Parse the payload from the pg_net webhook (bbf_evaluate_streaks)
    const { client_email, client_name, client_phone, days_missed, protocol } = await req.json();

    if (!client_phone) {
      throw new Error(`Cannot initiate call for ${client_email}: No phone number provided.`);
    }

    // Construct the Vapi outbound call payload
    const vapiPayload = {
      phoneNumber: {
        twilioPhoneNumber: TWILIO_PHONE_NUMBER,
        phoneNumber: client_phone
      },
      assistantId: VAPI_ASSISTANT_ID,
      assistantOverrides: {
        variableValues: {
          clientName: client_name || 'Client',
          daysMissed: String(days_missed || 3),
          programFocus: protocol || 'Training Protocol',
          coachName: 'Akeem'
        }
      }
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
