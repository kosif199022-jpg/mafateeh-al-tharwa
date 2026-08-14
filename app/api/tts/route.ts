const GEMINI_TTS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const GEMINI_FALLBACK_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const MAX_TEXT_LENGTH = 2800;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 90;

type VoiceChoice = "male" | "female" | "mixed";
type ModelChoice = "3.1" | "2.5";
type RateBucket = { count: number; resetAt: number };

const runtimeState = globalThis as typeof globalThis & {
  __mafateehTtsRateBuckets?: Map<string, RateBucket>;
};
const rateBuckets =
  runtimeState.__mafateehTtsRateBuckets ??
  (runtimeState.__mafateehTtsRateBuckets = new Map<string, RateBucket>());

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function allowRequest(request: Request) {
  const now = Date.now();
  const forwarded = request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || "anonymous";
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function makeSpeechRequest(text: string, voice: VoiceChoice, model: ModelChoice) {
  const instructions =
    "Synthesize natural Modern Standard Arabic audiobook speech. " +
    "Read only the content after TRANSCRIPT. Never read these instructions, labels, or speaker names. " +
    "Use calm, warm, expressive delivery, clear articulation, and comfortable medium pacing.";

  if (voice === "mixed") {
    const paragraphs = text.split(/\n+/).map((part) => part.trim()).filter(Boolean);
    const transcript = paragraphs
      .map((part, index) => `${index % 2 === 0 ? "Narrator" : "Guide"}: ${part}`)
      .join("\n");
    return {
      model: model === "2.5" ? GEMINI_FALLBACK_TTS_MODEL : GEMINI_TTS_MODEL,
      input: `${instructions}\nThe Narrator and Guide alternate naturally between paragraphs.\nTRANSCRIPT:\n${transcript}`,
      response_format: { type: "audio" },
      generation_config: {
        speech_config: [
          { speaker: "Narrator", voice: "Charon" },
          { speaker: "Guide", voice: "Kore" },
        ],
      },
    };
  }

  const profile = voice === "female"
    ? "Use a warm, poised adult female voice."
    : "Use a calm, confident adult male voice.";
  return {
    model: model === "2.5" ? GEMINI_FALLBACK_TTS_MODEL : GEMINI_TTS_MODEL,
    input: `${instructions}\n${profile}\nTRANSCRIPT:\n${text}`,
    response_format: { type: "audio" },
    generation_config: {
      speech_config: [{ voice: voice === "female" ? "Kore" : "Charon" }],
    },
  };
}

function decodeBase64(data: string) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function pcmToWave(pcm: Uint8Array, sampleRate = 24000) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  const wave = new Uint8Array(44 + pcm.byteLength);
  wave.set(new Uint8Array(header), 0);
  wave.set(pcm, 44);
  return wave;
}

async function requestGemini(apiKey: string, payload: unknown) {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(GEMINI_TTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(75_000),
    });
    lastResponse = response;
    if (![500, 502, 503].includes(response.status) || attempt === 1) return response;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return lastResponse as Response;
}

async function logGeminiFailure(response: Response) {
  let status = "unknown";
  let category = "unknown";
  try {
    const body = await response.json() as {
      error?: { status?: string; message?: string };
    };
    status = body.error?.status || status;
    const message = (body.error?.message || "").toLowerCase();
    if (message.includes("api key") || message.includes("api_key_invalid")) {
      category = "invalid_api_key";
    } else if (message.includes("billing") || message.includes("quota")) {
      category = "billing_or_quota";
    } else if (message.includes("permission") || message.includes("not authorized")) {
      category = "permission_denied";
    } else if (message.includes("model") && (message.includes("not found") || message.includes("not supported"))) {
      category = "model_access";
    } else if (message.includes("invalid argument") || status === "INVALID_ARGUMENT") {
      category = "invalid_request";
    }
  } catch {
    category = "unreadable_error";
  }
  console.error("Gemini TTS request failed", response.status, status, category);
}

export async function GET() {
  return json({ enabled: Boolean(process.env.GEMINI_API_KEY) });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "origin_not_allowed" }, 403);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return json({ error: "origin_not_allowed" }, 403);
  }
  if (!allowRequest(request)) return json({ error: "rate_limit" }, 429);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: "tts_not_configured" }, 503);

  let body: { text?: unknown; voice?: unknown; model?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const text = cleanText(body.text);
  const voice = String(body.voice ?? "male") as VoiceChoice;
  const model = String(body.model ?? "3.1") as ModelChoice;
  if (!text || text.length < 2) return json({ error: "empty_text" }, 400);
  if (text.length > MAX_TEXT_LENGTH) {
    return json({ error: "text_too_long", maxLength: MAX_TEXT_LENGTH }, 413);
  }
  if (!["male", "female", "mixed"].includes(voice)) {
    return json({ error: "invalid_voice" }, 400);
  }
  if (!["3.1", "2.5"].includes(model)) {
    return json({ error: "invalid_model" }, 400);
  }

  try {
    const response = await requestGemini(apiKey, makeSpeechRequest(text, voice, model));
    if (!response.ok) {
      const error = response.status === 429 ? "gemini_quota" :
        response.status >= 500 ? "gemini_unavailable" : "gemini_rejected";
      await logGeminiFailure(response);
      return json({ error }, response.status === 429 ? 429 : 502);
    }

    const result = await response.json() as {
      output_audio?: { data?: string; mime_type?: string };
      steps?: Array<{
        type?: string;
        content?: Array<{ type?: string; data?: string; mime_type?: string }>;
      }>;
    };
    const stepAudio = result.steps
      ?.slice()
      .reverse()
      .flatMap((step) => step.type === "model_output" ? (step.content ?? []) : [])
      .find((item) => item.type === "audio" && typeof item.data === "string");
    const encoded = result.output_audio?.data ?? stepAudio?.data;
    if (!encoded) {
      console.error("Gemini TTS response did not contain audio");
      return json({ error: "gemini_no_audio" }, 502);
    }

    const pcm = decodeBase64(encoded);
    const wave = pcmToWave(pcm);
    return new Response(wave, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wave.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Gemini TTS request error", error instanceof Error ? error.name : "unknown");
    return json({ error: "tts_request_failed" }, 502);
  }
}
