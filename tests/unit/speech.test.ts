import { describe, expect, it } from "vitest";
import { getAnnouncerVoiceProfile, resolveAnnouncerVoice } from "@/lib/speech";

const voices = [
  { name: "Microsoft Zira", voiceURI: "zira", lang: "en-US", default: true },
  { name: "Microsoft David", voiceURI: "david", lang: "en-US", default: false },
  { name: "French Voice", voiceURI: "french", lang: "fr-FR", default: false },
];

describe("announcer voice profiles", () => {
  it("defaults every client to the male announcer profile", () => {
    expect(getAnnouncerVoiceProfile(null)).toBe("drafthq:male");
    expect(resolveAnnouncerVoice(voices, null)?.name).toBe("Microsoft David");
  });

  it("uses a female fallback when an old female voice URI is unavailable", () => {
    expect(getAnnouncerVoiceProfile("Microsoft Samantha Desktop")).toBe("drafthq:female");
    expect(resolveAnnouncerVoice(voices, "Microsoft Samantha Desktop")?.name).toBe("Microsoft Zira");
  });

  it("honors the shared female profile", () => {
    expect(resolveAnnouncerVoice(voices, "drafthq:female")?.name).toBe("Microsoft Zira");
  });
});

