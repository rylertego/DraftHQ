import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmail } from "@/lib/email";
import { leagueInviteEmail } from "@/lib/emailTemplates";

interface RouteContext {
  params: Promise<{ leagueId: string }>;
}

async function getCommissioner(request: Request, leagueId: string) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!accessToken) return { error: "Authentication is required.", status: 401, user: null };

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) return { error: "Invalid authentication session.", status: 401, user: null };

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membershipError) {
    console.error("[members/route] league_members query error:", membershipError.message);
  }

  // Fallback: check owner_user_id on the league itself (covers cases where
  // the service_role can't read league_members due to explicit REVOKE).
  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("owner_user_id")
    .eq("id", leagueId)
    .maybeSingle();

  if (leagueError) {
    console.error("[members/route] leagues query error:", leagueError.message);
  }

  const isCommissioner =
    membership?.role === "commissioner" ||
    league?.owner_user_id === userData.user.id;

  if (!isCommissioner) {
    return { error: "Only the commissioner can manage members.", status: 403, user: null };
  }

  return { error: null, status: 200, user: userData.user };
}

export async function POST(request: Request, { params }: RouteContext) {
  const { leagueId } = await params;
  const { error, status, user } = await getCommissioner(request, leagueId);
  if (error || !user) return Response.json({ error }, { status });

  let body: { email?: unknown; leagueTeamId?: unknown; draftTeamId?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; leagueTeamId?: unknown; draftTeamId?: unknown };
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const requestedLeagueTeamId = typeof body.leagueTeamId === "string" ? body.leagueTeamId : null;
  const requestedDraftTeamId = typeof body.draftTeamId === "string" ? body.draftTeamId : null;

  // Look up the league slug for the redirect URL
  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("slug,name")
    .eq("id", leagueId)
    .maybeSingle();

  if (leagueError || !league) return Response.json({ error: "League not found." }, { status: 404 });

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const token = crypto.randomUUID();
  const redirectTo = `${siteOrigin}/dashboard?invitation=${token}`;

  let leagueTeamId = requestedLeagueTeamId;
  let draftId: string | null = null;
  const draftTeamId: string | null = requestedDraftTeamId;

  if (requestedLeagueTeamId) {
    const { data: team, error: teamError } = await supabaseAdmin
      .from("league_teams")
      .select("id,owner_user_id")
      .eq("id", requestedLeagueTeamId)
      .eq("league_id", leagueId)
      .maybeSingle();
    if (teamError) return Response.json({ error: `Unable to validate league team: ${teamError.message}` }, { status: 500 });
    if (!team) return Response.json({ error: "League team not found." }, { status: 404 });
    if (team.owner_user_id) return Response.json({ error: "That team already has an owner." }, { status: 409 });
  } else if (requestedDraftTeamId) {
    const { data: draftTeam, error: draftTeamError } = await supabaseAdmin
      .from("teams")
      .select("draft_id")
      .eq("id", requestedDraftTeamId)
      .maybeSingle();
    if (draftTeamError) return Response.json({ error: `Unable to validate draft team: ${draftTeamError.message}` }, { status: 500 });
    if (!draftTeam) return Response.json({ error: "Draft team not found." }, { status: 404 });
    draftId = draftTeam.draft_id;
    const { data: season, error: seasonError } = await supabaseAdmin
      .from("league_seasons")
      .select("id")
      .eq("league_id", leagueId)
      .eq("draft_id", draftId)
      .maybeSingle();
    if (seasonError) return Response.json({ error: `Unable to validate league season: ${seasonError.message}` }, { status: 500 });
    if (!season) return Response.json({ error: "Draft does not belong to this league." }, { status: 400 });
    const { data: link, error: linkError } = await supabaseAdmin
      .from("league_team_seasons")
      .select("league_team_id")
      .eq("league_season_id", season.id)
      .eq("draft_team_id", requestedDraftTeamId)
      .maybeSingle();
    if (linkError) return Response.json({ error: `Unable to validate franchise assignment: ${linkError.message}` }, { status: 500 });
    if (!link) return Response.json({ error: "Unable to match that draft team to a franchise." }, { status: 400 });
    leagueTeamId = link.league_team_id;
  }

  // Check if user already exists
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return Response.json({ error: listError.message }, { status: 500 });

  const existingUser = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let targetUserId: string;
  let invited = false;
  let emailWarning: string | null = null;
  let actionLink: string | null = null;

  if (existingUser) {
    targetUserId = existingUser.id;
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkError) {
      emailWarning = `Could not generate sign-in link: ${linkError.message}`;
    } else {
      actionLink = linkData.properties.action_link;
    }
  } else {
    // No account yet — create one and get a one-time link, but suppress Supabase's own email
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: { pending_league_id: leagueId, pending_league_slug: league.slug, pending_league_invitation_token: token },
      },
    });
    if (linkError) return Response.json({ error: `Could not create invite: ${linkError.message}` }, { status: 500 });
    targetUserId = linkData.user.id;
    actionLink = linkData.properties.action_link;
    invited = true;
  }

  const { data: existingMember } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (existingMember && !leagueTeamId) return Response.json({ error: "That person is already a member of this league." }, { status: 409 });

  const { data: existingInvitation } = await supabaseAdmin
    .from("league_invitations")
    .select("id")
    .eq("league_id", leagueId)
    .eq("invited_user_id", targetUserId)
    .eq("status", "pending")
    .maybeSingle();

  const invitationValues = {
    league_id: leagueId,
    league_team_id: leagueTeamId,
    draft_id: draftId,
    draft_team_id: draftTeamId,
    email,
    invited_user_id: targetUserId,
    invited_by_user_id: user.id,
    token,
    status: "pending",
    invited_at: new Date().toISOString(),
    responded_at: null,
  };
  const invitationQuery = existingInvitation
    ? supabaseAdmin.from("league_invitations").update(invitationValues).eq("id", existingInvitation.id)
    : supabaseAdmin.from("league_invitations").insert(invitationValues);
  const { data: invitation, error: invitationError } = await invitationQuery
    .select("id,league_id,league_team_id,email,status,invited_at")
    .single();

  if (invitationError) return Response.json({ error: invitationError.message }, { status: 500 });

  if (actionLink) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      emailWarning = "The in-app invitation was created, but RESEND_API_KEY is not configured.";
    } else {
      let teamName: string | null = null;
      if (leagueTeamId) {
        const { data: teamRow } = await supabaseAdmin
          .from("league_teams")
          .select("name")
          .eq("id", leagueTeamId)
          .maybeSingle();
        teamName = teamRow?.name ?? null;
      }

      const commissionerName =
        (user.user_metadata?.display_name as string | undefined) ?? user.email ?? "The commissioner";

      const { subject, html, text } = leagueInviteEmail({
        leagueName: league.name,
        teamName,
        commissionerName,
        inviteUrl: actionLink,
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
        emailWarning = `The in-app invitation was created, but email delivery failed: ${emailError.message}`;
      }
    }
  }

  return Response.json({ invitation, invited, inviteUrl: redirectTo, warning: emailWarning }, { status: 201 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { leagueId } = await params;
  const { error, status, user } = await getCommissioner(request, leagueId);
  if (error || !user) return Response.json({ error }, { status });

  let body: { memberId?: unknown };
  try {
    body = (await request.json()) as { memberId?: unknown };
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId : null;
  if (!memberId) return Response.json({ error: "memberId is required." }, { status: 400 });

  const { data: target } = await supabaseAdmin
    .from("league_members")
    .select("user_id,role")
    .eq("id", memberId)
    .eq("league_id", leagueId)
    .maybeSingle();

  if (!target) return Response.json({ error: "Member not found." }, { status: 404 });
  if (target.user_id === user.id) return Response.json({ error: "You cannot remove yourself as commissioner." }, { status: 400 });

  const { error: deleteError } = await supabaseAdmin
    .from("league_members")
    .delete()
    .eq("id", memberId)
    .eq("league_id", leagueId);

  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

  return Response.json({ ok: true });
}
