// Sender for all transactional mail. Set RESEND_FROM to
// "DraftHQ <noreply@drafthq.net>" once drafthq.net is verified in Resend;
// until then the shared resend.dev sender keeps delivery working.
export function emailFrom() {
  return process.env.RESEND_FROM ?? "DraftHQ <onboarding@resend.dev>";
}

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
