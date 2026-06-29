import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/emailTemplates";

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const redirectTo = `${siteOrigin}/reset-password`;

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  // Always return success to avoid revealing whether an account exists
  if (linkError) {
    console.error("[reset-password] generateLink error:", linkError.message);
    return Response.json({ ok: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[reset-password] RESEND_API_KEY not configured");
    return Response.json({ ok: true });
  }

  const { subject, html, text } = passwordResetEmail({
    resetUrl: linkData.properties.action_link,
  });

  const resend = new Resend(apiKey);
  const { error: emailError } = await resend.emails.send({
    from: "DraftHQ <onboarding@resend.dev>",
    to: email,
    subject,
    html,
    text,
  });

  if (emailError) {
    console.error("[reset-password] Resend error:", emailError.message);
  }

  return Response.json({ ok: true });
}
