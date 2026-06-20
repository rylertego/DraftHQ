export interface ProfileInput {
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
}

export function normalizeProfileInput(input: {
  displayName: string;
  avatarUrl: string;
  bio: string;
}): ProfileInput {
  const displayName = input.displayName.trim();
  const avatarUrl = input.avatarUrl.trim() || null;
  const bio = input.bio.trim() || null;

  if (displayName.length < 1 || displayName.length > 50) {
    throw new Error("Display name must be between 1 and 50 characters.");
  }

  if (avatarUrl && avatarUrl.length > 2048) {
    throw new Error("Avatar URL is too long.");
  }

  if (avatarUrl) {
    try {
      const url = new URL(avatarUrl);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error();
      }
    } catch {
      throw new Error("Avatar URL must be a valid HTTP or HTTPS URL.");
    }
  }

  if (bio && bio.length > 280) {
    throw new Error("Bio must be 280 characters or fewer.");
  }

  return { displayName, avatarUrl, bio };
}
