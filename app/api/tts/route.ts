import {
  cleanText,
  generateGeminiSpeech,
  json,
  rateLimit,
  sameOrigin,
  type VoiceChoice,
} from "../_lib/ai";

const MAX_TEXT_LENGTH = 2800;

/**
 * Backward-compatible legacy endpoint.
 * New clients should use /api/ai/tts. Keeping this route thin prevents the
 * Gemini request, origin checks, WAV conversion and retry logic from drifting
 * away from the canonical AI implementation.
 */
export async function GET() {
  return json({
    enabled: Boolean(process.env.GEMINI_API_KEY),
    legacy: true,
    canonicalEndpoint: "/api/ai/tts",
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "origin_not_allowed" }, 403);
  if (!rateLimit(request, "tts-legacy", 80)) return json({ error: "rate_limit" }, 429);

  let body: { text?: unknown; voice?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const text = cleanText(body.text, MAX_TEXT_LENGTH + 1);
  const voice = String(body.voice ?? "male") as VoiceChoice;

  if (!text || text.length < 2) return json({ error: "empty_text" }, 400);
  if (text.length > MAX_TEXT_LENGTH) {
    return json({ error: "text_too_long", maxLength: MAX_TEXT_LENGTH }, 413);
  }
  if (!( ["male", "female", "mixed"] as string[] ).includes(voice)) {
    return json({ error: "invalid_voice" }, 400);
  }

  try {
    const wave = await generateGeminiSpeech(text, voice);
    return new Response(wave, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wave.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Deprecation": "true",
        "Link": "</api/ai/tts>; rel=successor-version",
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "tts_failed";
    return json({ error: code }, code.includes("not_configured") ? 503 : code.includes("quota") ? 429 : 502);
  }
}
