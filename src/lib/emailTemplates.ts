const SITE_URL = "https://draft-hq.vercel.app";
const LOGO_URL = `${SITE_URL}/branding/logo-primary.png`;

function emailLayout(title: string, eyebrow: string, body: string, footerNote: string) {
  return `<!DOCTYPE html>
<html lang="en" bgcolor="#0f172a">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body bgcolor="#0f172a" style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0f172a" style="background:#0f172a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="${LOGO_URL}" alt="DraftHQ" width="260" style="display:block;height:auto;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td bgcolor="#1e293b" style="background:#1e293b;border-radius:16px;border:1px solid #334155;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#14b8a6;">${eyebrow}</p>
              ${body}
              <hr style="margin:32px 0;border:none;border-top:1px solid #334155;" />
              <p style="margin:0;font-size:11px;color:#475569;text-align:center;">
                Sent by DraftHQ · ${footerNote}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(url: string, label: string) {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 0;">
    <tr>
      <td align="center">
        <a href="${url}" style="display:inline-block;background:#14b8a6;color:#0f172a;font-weight:800;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.01em;">${label}</a>
      </td>
    </tr>
  </table>
  <p style="margin:24px 0 0;font-size:12px;color:#64748b;text-align:center;line-height:1.6;">
    Or copy this link into your browser:<br />
    <a href="${url}" style="color:#14b8a6;word-break:break-all;">${url}</a>
  </p>`;
}

export function draftInviteEmail({
  draftName,
  teamName,
  commissionerName,
  joinUrl,
}: {
  draftName: string;
  teamName: string;
  commissionerName: string;
  joinUrl: string;
}) {
  const subject = `You've been invited to join ${draftName}`;

  const body = `
    <h1 style="margin:0 0 20px;font-size:26px;font-weight:900;color:#f8fafc;line-height:1.2;">
      You're invited to<br />${escapeHtml(draftName)}
    </h1>
    <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.6;">
      <strong style="color:#e2e8f0;">${escapeHtml(commissionerName)}</strong> has reserved
      <strong style="color:#e2e8f0;">${escapeHtml(teamName)}</strong> for you.
      Click below to claim your team and join the draft room.
    </p>
    ${ctaButton(joinUrl, "Accept Invitation →")}`;

  const html = emailLayout(subject, "Draft Invitation", body, "You received this because someone invited you to a draft.");
  const text = `${commissionerName} has invited you to join ${draftName} as ${teamName}.\n\nAccept your invitation: ${joinUrl}`;

  return { subject, html, text };
}

export function leagueInviteEmail({
  leagueName,
  teamName,
  commissionerName,
  inviteUrl,
}: {
  leagueName: string;
  teamName: string | null;
  commissionerName: string;
  inviteUrl: string;
}) {
  const subject = `You've been invited to join ${leagueName}`;

  const bodyText = teamName
    ? `<strong style="color:#e2e8f0;">${escapeHtml(commissionerName)}</strong> has reserved
       <strong style="color:#e2e8f0;">${escapeHtml(teamName)}</strong> for you in
       <strong style="color:#e2e8f0;">${escapeHtml(leagueName)}</strong>. Click below to accept and claim your team.`
    : `<strong style="color:#e2e8f0;">${escapeHtml(commissionerName)}</strong> has invited you to join
       <strong style="color:#e2e8f0;">${escapeHtml(leagueName)}</strong>.`;

  const body = `
    <h1 style="margin:0 0 20px;font-size:26px;font-weight:900;color:#f8fafc;line-height:1.2;">
      You're invited to<br />${escapeHtml(leagueName)}
    </h1>
    <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.6;">${bodyText}</p>
    ${ctaButton(inviteUrl, "Accept Invitation →")}`;

  const html = emailLayout(subject, "League Invitation", body, "You received this because someone invited you to a league.");
  const text = teamName
    ? `${commissionerName} has reserved ${teamName} for you in ${leagueName}.\n\nAccept your invitation: ${inviteUrl}`
    : `${commissionerName} has invited you to join ${leagueName}.\n\nAccept: ${inviteUrl}`;

  return { subject, html, text };
}

export function passwordResetEmail({ resetUrl }: { resetUrl: string }) {
  const subject = "Reset your DraftHQ password";

  const body = `
    <h1 style="margin:0 0 20px;font-size:34px;font-weight:900;color:#14b8a6;line-height:1.2;">
      Reset your password
    </h1>
    <p style="margin:0;font-size:15px;color:#e2e8f0;line-height:1.6;">
      Click the button below to set a new password. This link expires in 1 hour.
      If you didn&apos;t request this, you can safely ignore this email.
    </p>
    ${ctaButton(resetUrl, "Reset Password →")}`;

  const html = emailLayout(subject, "Password Reset", body, "You received this because a password reset was requested for your account.");
  const text = `Reset your DraftHQ password:\n\n${resetUrl}\n\nExpires in 1 hour. If you didn't request this, ignore this email.`;

  return { subject, html, text };
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
