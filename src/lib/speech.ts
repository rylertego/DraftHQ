export type AnnouncerVoiceProfile = "drafthq:male" | "drafthq:female";

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
