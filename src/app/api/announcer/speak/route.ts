import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAiAnnouncerPersona, getElevenLabsVoiceId, isAiAnnouncerEnabled } from "@/lib/speech";

// Announcement sentences are short; this cap is a cost guard against the
// endpoint being used as a general-purpose TTS proxy.
const MAX_TEXT_LENGTH = 240;

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

async function cacheHit(publicUrl: string): Promise<boolean> {
  try {
    const head = await fetch(publicUrl, { method: "HEAD" });
    return head.ok;
  } catch {
    return false;
  }
}

async function uploadClip(path: string, audio: Buffer): Promise<boolean> {
  const { error } = await supabaseAdmin.storage
    .from("announcer-clips")
    .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  return !error;
}

export async function POST(request: Request) {
  if (!isAiAnnouncerEnabled()) {
    return Response.json(
      { error: "AI announcer is disabled in this environment." },
      { status: 503 }
    );
  }

  // Authenticated users only — this endpoint spends provider credits.
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { text?: unknown; personaId?: unknown; draftId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return Response.json(
      { error: `Text must be 1-${MAX_TEXT_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const personaId = typeof body.personaId === "string" ? body.personaId : null;

  // ── ElevenLabs custom voice (bring-your-own key) ────────────────────────
  const elVoiceId = getElevenLabsVoiceId(personaId);
  if (elVoiceId) {
    if (!/^[a-zA-Z0-9]{8,64}$/.test(elVoiceId)) {
      return Response.json({ error: "Invalid ElevenLabs voice id." }, { status: 400 });
    }
    // BYO-key clips are cached per draft so one user's ElevenLabs credits
    // never subsidize other leagues (house-persona clips stay global).
    const draftId = typeof body.draftId === "string" ? body.draftId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draftId)) {
      return Response.json({ error: "A valid draftId is required for custom voices." }, { status: 400 });
    }

    const hash = createHash("sha256").update(`${elVoiceId}\n${text}`).digest("hex");
    const path = `el/${draftId}/${hash}.mp3`;
    const { data: pub } = supabaseAdmin.storage.from("announcer-clips").getPublicUrl(path);

    if (await cacheHit(pub.publicUrl)) {
      return Response.json({ url: pub.publicUrl, cached: true });
    }

    // Only clients holding the commissioner's key can generate; everyone else
    // plays cached clips (or falls back to device TTS for uncached lines).
    const elKey = request.headers.get("x-elevenlabs-key")?.trim();
    if (!elKey) {
      return Response.json(
        { error: "An ElevenLabs API key is required to generate this clip." },
        { status: 403 }
      );
    }

    const ttsRes = await fetch(
      `${ELEVENLABS_TTS_URL}/${elVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": elKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
      }
    );
    if (!ttsRes.ok) {
      const status = ttsRes.status === 401 ? 401 : 502;
      return Response.json(
        { error: `ElevenLabs generation failed (${ttsRes.status}).` },
        { status }
      );
    }

    const audio = Buffer.from(await ttsRes.arrayBuffer());
    if (!(await uploadClip(path, audio))) {
      return Response.json({ error: "Failed to cache the clip." }, { status: 500 });
    }
    return Response.json({ url: pub.publicUrl, cached: false });
  }

  // ── House persona (OpenAI, DraftHQ's key, global cache) ─────────────────
  // The server resolves voice + style from the persona table; clients cannot
  // pass arbitrary voices or instructions.
  const persona = getAiAnnouncerPersona(personaId);
  if (!persona) {
    return Response.json({ error: "Unknown announcer persona." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI announcer is not configured. Set OPENAI_API_KEY." },
      { status: 503 }
    );
  }

  const hash = createHash("sha256").update(`${persona.id}\n${text}`).digest("hex");
  const personaFolder = persona.id.replace(/[^a-z0-9]+/gi, "-");
  const path = `${personaFolder}/${hash}.mp3`;
  const { data: pub } = supabaseAdmin.storage.from("announcer-clips").getPublicUrl(path);

  // Cache hit — identical announcements are generated once, ever.
  if (await cacheHit(pub.publicUrl)) {
    return Response.json({ url: pub.publicUrl, cached: true });
  }

  const ttsRes = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: persona.openAiVoice,
      input: text,
      instructions: persona.instructions,
      response_format: "mp3",
    }),
  });

  if (!ttsRes.ok) {
    return Response.json(
      { error: `Voice generation failed (${ttsRes.status}).` },
      { status: 502 }
    );
  }

  const audio = Buffer.from(await ttsRes.arrayBuffer());
  if (!(await uploadClip(path, audio))) {
    return Response.json({ error: "Failed to cache the clip." }, { status: 500 });
  }

  return Response.json({ url: pub.publicUrl, cached: false });
}
