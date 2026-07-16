export type AnnouncerVoiceProfile = "drafthq:male" | "drafthq:female";

// ── AI announcer availability ────────────────────────────────────────────
// Cloud voice generation (OpenAI personas + ElevenLabs BYO) is disabled
// everywhere until the feature is fleshed out — opt in per environment with
// NEXT_PUBLIC_AI_ANNOUNCER_ENABLED=true (e.g. in .env.local while working on
// it). NEXT_PUBLIC_ so the same check works in the browser (hide UI) and on
// the server (refuse generation).
export function isAiAnnouncerEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AI_ANNOUNCER_ENABLED === "true";
}

// ── AI announcer personas ────────────────────────────────────────────────
// Generated server-side via the /api/announcer/speak route (OpenAI TTS) and
// cached in Supabase storage. The persona id is stored in
// drafts.announcer_voice_uri alongside the legacy device-voice profiles.
// The server resolves voice + instructions from this table — clients only
// ever send the persona id.

export interface AnnouncerPersona {
  id: string;
  label: string;
  /** OpenAI TTS voice name */
  openAiVoice: string;
  /** Style prompt for gpt-4o-mini-tts */
  instructions: string;
  /** Device-voice profile used when clip generation is unavailable */
  fallbackProfile: AnnouncerVoiceProfile;
}

export const AI_ANNOUNCER_PERSONAS: AnnouncerPersona[] = [
  {
    id: "drafthq:ai:legend",
    label: "The Broadcast Legend (AI)",
    openAiVoice: "onyx",
    instructions:
      "You are a legendary prime-time NFL draft broadcaster. Deep, measured, " +
      "authoritative delivery with gravitas. Slight dramatic pause before the " +
      "player's name. Announce like the moment matters.",
    fallbackProfile: "drafthq:male",
  },
];

export function getAiAnnouncerPersona(
  value: string | null | undefined
): AnnouncerPersona | null {
  if (!value) return null;
  return AI_ANNOUNCER_PERSONAS.find((persona) => persona.id === value) ?? null;
}

// ── ElevenLabs custom voices (bring-your-own account) ────────────────────
// Stored in drafts.announcer_voice_uri as "drafthq:el:<voiceId>". Generation
// requires the commissioner's own ElevenLabs API key (sent per-request from
// their browser, never persisted server-side); playback of cached clips
// needs no key, so every client in the room hears the same voice.

export const ELEVENLABS_VOICE_PREFIX = "drafthq:el:";

export function getElevenLabsVoiceId(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(ELEVENLABS_VOICE_PREFIX)) return null;
  const voiceId = value.slice(ELEVENLABS_VOICE_PREFIX.length).trim();
  return voiceId || null;
}

/** The configured announcer's clip id when it is a cloud-generated voice and
 * cloud generation is enabled in this environment; null means "use the
 * device voice" (a stored AI setting silently degrades when disabled). */
export function getAiAnnouncerId(value: string | null | undefined): string | null {
  if (!isAiAnnouncerEnabled()) return null;
  if (getAiAnnouncerPersona(value)) return value ?? null;
  if (getElevenLabsVoiceId(value)) return value ?? null;
  return null;
}

type VoiceLike = Pick<SpeechSynthesisVoice, "name" | "voiceURI" | "lang" | "default">;

const MALE_NAMES = [
  "david", "guy", "mark", "daniel", "alex", "fred", "tom", "james",
  "george", "ryan", "andrew", "brian", "christopher", "eric", "roger",
  "stefan", "male",
];
const FEMALE_NAMES = [
  "zira", "aria", "jenny", "samantha", "victoria", "karen", "susan",
  "hazel", "ava", "emma", "sonia", "libby", "michelle", "natasha",
  "clara", "moira", "tessa", "female",
];

function voiceLabel(voice: VoiceLike) {
  return `${voice.name} ${voice.voiceURI}`.toLowerCase();
}

export function getAnnouncerVoiceProfile(value: string | null | undefined): AnnouncerVoiceProfile {
  const persona = getAiAnnouncerPersona(value);
  if (persona) return persona.fallbackProfile;
  if (getElevenLabsVoiceId(value)) return "drafthq:male";
  const label = (value ?? "").toLowerCase();
  if (value === "drafthq:female" || FEMALE_NAMES.some((name) => label.includes(name))) {
    return "drafthq:female";
  }
  return "drafthq:male";
}

/** Resolve the same announcer profile on every client without using the
 * browser's device-specific default voice. */
export function resolveAnnouncerVoice<T extends VoiceLike>(
  voices: T[],
  configuredVoice: string | null | undefined
): T | null {
  if (voices.length === 0) return null;

  const profile = getAnnouncerVoiceProfile(configuredVoice);
  const preferredNames = profile === "drafthq:female" ? FEMALE_NAMES : MALE_NAMES;
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const candidates = englishVoices.length > 0 ? englishVoices : voices;

  for (const preferredName of preferredNames) {
    const match = candidates.find((voice) => voiceLabel(voice).includes(preferredName));
    if (match) return match;
  }

  return [...candidates].sort((a, b) =>
    `${a.lang}:${a.name}`.localeCompare(`${b.lang}:${b.name}`)
  )[0] ?? null;
}
