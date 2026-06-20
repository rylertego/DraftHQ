import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmail } from "@/lib/email";

interface InvitationRequest {
  email?: unknown;
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

  if (!email) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { draftId } = await params;
  const { data: draft, error: draftError } = await supabaseAdmin
    .from("drafts")
    .select("id,join_code,commissioner_user_id")
    .eq("id", draftId)
    .maybeSingle();

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

  const { data: existingInvitation, error: existingInvitationError } =
    await supabaseAdmin
    .from("draft_invitations")
    .select("status")
    .eq("draft_id", draftId)
    .eq("email", email)
    .maybeSingle();

  if (existingInvitationError) {
    return Response.json(
      { error: existingInvitationError.message },
      { status: 500 }
    );
  }

  if (existingInvitation?.status === "accepted") {
    return Response.json(
      { error: "This email has already joined the draft." },
      { status: 409 }
    );
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const siteOrigin = configuredSiteUrl ?? new URL(request.url).origin;
  const redirectTo = new URL(`/join/${draft.join_code}`, siteOrigin).toString();
  const { error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        draft_id: draftId,
        join_code: draft.join_code,
      },
    });

  if (inviteError) {
    return Response.json({ error: inviteError.message }, { status: 400 });
  }

  const { data: invitation, error: invitationError } = await supabaseAdmin
    .from("draft_invitations")
    .upsert(
      {
        draft_id: draftId,
        email,
        invited_by_user_id: userData.user.id,
        participant_id: null,
        status: "pending",
        invited_at: new Date().toISOString(),
        accepted_at: null,
      },
      { onConflict: "draft_id,email" }
    )
    .select("id,draft_id,email,status,participant_id,invited_at,accepted_at")
    .single();

  if (invitationError) {
    return Response.json({ error: invitationError.message }, { status: 500 });
  }

  return Response.json({ invitation }, { status: 201 });
}
