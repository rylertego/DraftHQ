import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAiAnnouncerEnabled } from "@/lib/speech";

// Proxies the ElevenLabs voice list for the commissioner's own account so the
// settings UI can offer a voice picker. The key comes from the request and is
// never persisted.

interface ElevenLabsVoiceRow {
  voice_id?: string;
  name?: string;
  category?: string;
}

export async function GET(request: Request) {
  if (!isAiAnnouncerEnabled()) {
    return Response.json(
      { error: "AI announcer is disabled in this environment." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const elKey = request.headers.get("x-elevenlabs-key")?.trim();
  if (!elKey) {
    return Response.json({ error: "Missing ElevenLabs API key." }, { status: 400 });
  }

  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": elKey },
  });
  if (res.status === 401) {
    return Response.json({ error: "Invalid ElevenLabs API key." }, { status: 401 });
  }
  if (!res.ok) {
    return Response.json({ error: `ElevenLabs request failed (${res.status}).` }, { status: 502 });
  }

  const payload = (await res.json()) as { voices?: ElevenLabsVoiceRow[] };
  const voices = (payload.voices ?? [])
    .filter((voice) => typeof voice.voice_id === "string" && typeof voice.name === "string")
    .map((voice) => ({
      id: voice.voice_id as string,
      name: voice.name as string,
      category: voice.category ?? "custom",
    }));

  return Response.json({ voices });
}
