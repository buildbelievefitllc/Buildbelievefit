// bbf_vision_scout
// Looks at a webpage and tells you what's on it, using Claude's eyes.

import { encodeBase64 } from "jsr:@std/encoding/base64";

Deno.serve(async (req) => {
  try {
    // 1. The website address you want to look at (sent in when you call this)
    const { url, question } = await req.json();

    // 2. Your secret keys (you'll add these in Supabase Secrets in a minute)
    const BROWSERLESS_TOKEN = Deno.env.get("BROWSERLESS_TOKEN");
    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    // 3. Ask the cloud browser to take a screenshot of the page
    const shot = await fetch(
      `https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, options: { fullPage: false, type: "png" } }),
      }
    );
    const imageBytes = new Uint8Array(await shot.arrayBuffer());

    // 4. Turn the screenshot into text Claude can read
    const base64Image = encodeBase64(imageBytes);

    // 5. Show the screenshot to Claude and ask what it sees
    const claude = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: base64Image },
              },
              {
                type: "text",
                text:
                  question ||
                  "Describe this webpage. List every button, link, and form field you see, and where each one is on the page.",
              },
            ],
          },
        ],
      }),
    });

    const result = await claude.json();

    // 6. Send Claude's answer back
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Matches your house style: never hard-fail, return 200 with the error
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});