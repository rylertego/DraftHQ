export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();

  if (
    email.length < 3 ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }

  return email;
}

/**
 * The From address for all transactional mail.
 *
 * Defaults to Resend's shared sandbox sender, which is fine locally but must
 * not be used in production: `resend.dev` is shared across every Resend
 * account, so it carries no domain reputation and Resend limits who it will
 * deliver to. Set RESEND_FROM to an address on a domain verified in Resend
 * (e.g. "DraftHQ <noreply@drafthq.net>") once its DNS records are in place.
 *
 * Kept in one place so the three sending routes cannot drift apart.
 */
export const TRANSACTIONAL_FROM =
  process.env.RESEND_FROM ?? "DraftHQ <onboarding@resend.dev>";
