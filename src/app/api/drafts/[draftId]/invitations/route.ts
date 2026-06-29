import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmail } from "@/lib/email";
import { draftInviteEmail } from "@/lib/emailTemplates";

interface InvitationRequest {
  email?: unknown;
  teamId?: unknown;
  sendEmail?: unknown;
}

interface InvitationRouteContext {
  params: Promise<{
    draftId: string;
  }>;
}

export async function POST(
  request: Request,
  { params }: InvitationRouteContext
) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return Response.json({ error: "Invalid authentication session." }, { status: 401 });
  }

  let body: InvitationRequest;

  try {
    body = (await request.json()) as InvitationRequest;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const teamId = typeof body.teamId === "string" ? body.teamId : "";
  const sendEmail = body.sendEmail !== false;

  if (!email) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(teamId)) {
    return Response.json({ error: "Select a valid team." }, { status: 400 });
  }

  const { draftId } = await params;

  const [
    { data: draft, error: draftError },
    { data: team, error: teamError },
  ] = await Promise.all([
    supabaseAdmin
      .from("drafts")
      .select("id,name,join_code,commissioner_user_id")
      .eq("id", draftId)
      .maybeSingle(),
    supabaseAdmin
      .from("teams")
      .select("id,name")
      .eq("id", teamId)
      .eq("draft_id", draftId)
      .maybeSingle(),
  ]);

  if (draftError) {
    return Response.json({ error: draftError.message }, { status: 500 });
  }

  if (!draft) {
    return Response.json({ error: "Draft not found." }, { status: 404 });
  }

  if (draft.commissioner_user_id !== userData.user.id) {
    return Response.json(
      { error: "Only the commissioner can invite owners." },
      { status: 403 }
    );
  }

  if (teamError) {
    return Response.json({ error: teamError.message }, { status: 500 });
  }

  if (!team) {
    return Response.json({ error: "Team not found in this draft." }, { status: 404 });
  }

  const [
    { data: teamParticipant, error: teamParticipantError },
    { data: reservedInvitation, error: reservedInvitationError },
  ] = await Promise.all([
    supabaseAdmin
      .from("draft_participants")
      .select("id")
      .eq("draft_id", draftId)
      .eq("team_id", teamId)
      .maybeSingle(),
    supabaseAdmin
      .from("draft_invitations")
      .select("email")
      .eq("draft_id", draftId)
      .eq("team_id", teamId)
      .eq("status", "pending")
      .neq("email", email)
      .maybeSingle(),
  ]);

  if (teamParticipantError) {
    return Response.json({ error: teamParticipantError.message }, { status: 500 });
  }

  if (reservedInvitationError) {
    return Response.json({ error: reservedInvitationError.message }, { status: 500 });
  }

  if (teamParticipant || reservedInvitation) {
    return Response.json({ error: "That team is already assigned." }, { status: 409 });
  }

  const { data: existingInvitation, error: existingInvitationError } =
    await supabaseAdmin
      .from("draft_invitations")
      .select("status")
      .eq("draft_id", draftId)
      .eq("email", email)
      .maybeSingle();

  if (existingInvitationError) {
    return Response.json({ error: existingInvitationError.message }, { status: 500 });
  }

  if (existingInvitation?.status === "accepted") {
    return Response.json(
      { error: "This email has already joined the draft." },
      { status: 409 }
    );
  }

  const { data: invitation, error: invitationError } = await supabaseAdmin
    .from("draft_invitations")
    .upsert(
      {
        draft_id: draftId,
        email,
        team_id: teamId,
        invited_by_user_id: userData.user.id,
        participant_id: null,
        status: "pending",
        invited_at: new Date().toISOString(),
        accepted_at: null,
      },
      { onConflict: "draft_id,email" }
    )
    .select("id,draft_id,email,team_id,status,participant_id,invited_at,accepted_at")
    .single();

  if (invitationError) {
    return Response.json({ error: invitationError.message }, { status: 500 });
  }

  let inviteWarning: string | null = null;

  if (sendEmail) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      inviteWarning = "Email not sent: RESEND_API_KEY is not configured.";
    } else {
      const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      const siteOrigin = configuredSiteUrl ?? new URL(request.url).origin;
      const joinUrl = new URL(`/join/${draft.join_code}`, siteOrigin).toString();

      const commissionerName =
        userData.user.user_metadata?.display_name as string | undefined ??
        userData.user.email ??
        "The commissioner";

      const { subject, html, text } = draftInviteEmail({
        draftName: draft.name,
        teamName: team.name,
        commissionerName,
        joinUrl,
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
        inviteWarning = `Team reserved, but email delivery failed: ${emailError.message}`;
      }
    }
  }

  return Response.json(
    {
      invitation,
      warning: inviteWarning,
    },
    { status: 201 }
  );
}
