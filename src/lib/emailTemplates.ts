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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo / wordmark -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">
                Draft<span style="color:#38bdf8;">HQ</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1e293b;border-radius:16px;border:1px solid #334155;padding:40px 36px;">

              <!-- Headline -->
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#38bdf8;">
                Draft Invitation
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:900;color:#f8fafc;line-height:1.2;">
                You're invited to<br />${escapeHtml(draftName)}
              </h1>

              <p style="margin:0 0 28px;font-size:15px;color:#94a3b8;line-height:1.6;">
                <strong style="color:#e2e8f0;">${escapeHtml(commissionerName)}</strong> has reserved
                <strong style="color:#e2e8f0;">${escapeHtml(teamName)}</strong> for you.
                Click below to claim your team and join the draft room.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${joinUrl}"
                       style="display:inline-block;background:#38bdf8;color:#0f172a;font-weight:800;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.01em;">
                      Accept Invitation →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="margin:32px 0;border:none;border-top:1px solid #334155;" />

              <!-- Fallback link -->
              <p style="margin:0;font-size:12px;color:#64748b;text-align:center;line-height:1.6;">
                Or copy this link into your browser:<br />
                <a href="${joinUrl}" style="color:#38bdf8;word-break:break-all;">${joinUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:#475569;">
                Sent by DraftHQ · You received this because someone invited you to a draft.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${commissionerName} has invited you to join ${draftName} as ${teamName}.\n\nAccept your invitation: ${joinUrl}`;

  return { subject, html, text };
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
