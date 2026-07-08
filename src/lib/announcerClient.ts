import { supabase } from "@/lib/supabase";
import { getElevenLabsVoiceId } from "@/lib/speech";

// The commissioner's ElevenLabs API key lives only in their browser and is
// sent per-request for clip generation — it is never persisted server-side.
const EL_KEY_STORAGE = "el:apiKey";

export function getStoredElevenLabsKey(): string | null {
  if (typeof window === "undefined") return null;
  const key = localStorage.getItem(EL_KEY_STORAGE);
  return key && key.trim() ? key.trim() : null;
}

export function storeElevenLabsKey(key: string | null) {
  try {
    if (key && key.trim()) localStorage.setItem(EL_KEY_STORAGE, key.trim());
    else localStorage.removeItem(EL_KEY_STORAGE);
  } catch {}
}

export interface ElevenLabsVoice {
  id: string;
  name: string;
  category: string;
}

/** List the voices available on an ElevenLabs account. Returns null when the
 * key is invalid or the request fails. */
export async function listElevenLabsVoices(key: string): Promise<ElevenLabsVoice[] | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;

    const res = await fetch("/api/announcer/voices", {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-elevenlabs-key": key,
      },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { voices?: ElevenLabsVoice[] };
    return Array.isArray(payload.voices) ? payload.voices : null;
  } catch {
    return null;
  }
}

/**
 * Fetch (or generate) a cached AI announcer clip for the given text.
 * `announcerId` is the raw announcer_voice_uri value — either a house persona
 * ("drafthq:ai:*") or an ElevenLabs voice ("drafthq:el:*"). For ElevenLabs,
 * the stored key is attached when present; without it, cached clips still
 * resolve but new ones cannot be generated.
 * Returns the public mp3 URL, or null on any failure — callers fall back to
 * device speech synthesis, so this never throws.
 */
export async function fetchAnnouncerClipUrl(
  text: string,
  announcerId: string,
  draftId?: string | null
): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (getElevenLabsVoiceId(announcerId)) {
      const elKey = getStoredElevenLabsKey();
      if (elKey) headers["x-elevenlabs-key"] = elKey;
    }

    const res = await fetch("/api/announcer/speak", {
      method: "POST",
      headers,
      body: JSON.stringify({ text, personaId: announcerId, draftId: draftId ?? null }),
    });
    if (!res.ok) return null;

    const payload = (await res.json()) as { url?: unknown };
    return typeof payload.url === "string" ? payload.url : null;
  } catch {
    return null;
  }
}
