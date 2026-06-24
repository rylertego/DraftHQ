import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmail } from "@/lib/email";

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

  const { data: membership } = await supabaseAdmin
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membership?.role !== "commissioner") {
    return { error: "Only the commissioner can manage members.", status: 403, user: null };
  }

  return { error: null, status: 200, user: userData.user };
}

export async function POST(request: Request, { params }: RouteContext) {
  const { leagueId } = await params;
  const { error, status, user } = await getCommissioner(request, leagueId);
  if (error || !user) return Response.json({ error }, { status });

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  // Look up the league slug for the redirect URL
  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("slug")
    .eq("id", leagueId)
    .maybeSingle();

  if (leagueError || !league) return Response.json({ error: "League not found." }, { status: 404 });

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const redirectTo = `${siteOrigin}/leagues/${league.slug as string}`;

  // Check if user already exists
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) return Response.json({ error: listError.message }, { status: 500 });

  const existingUser = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let targetUserId: string;
  let invited = false;

  if (existingUser) {
    targetUserId = existingUser.id;
  } else {
    // No account yet — create one via invite email, get the new user's ID immediately
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo, data: { pending_league_id: leagueId, pending_league_slug: league.slug } }
    );
    if (inviteError) return Response.json({ error: `Could not send invite: ${inviteError.message}` }, { status: 500 });
    targetUserId = inviteData.user.id;
    invited = true;
  }

  // Check if already a member
  const { data: existing } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (existing) return Response.json({ error: "That person is already a member of this league." }, { status: 409 });

  const { data: member, error: insertError } = await supabaseAdmin
    .from("league_members")
    .insert({ league_id: leagueId, user_id: targetUserId, role: "member" })
    .select("id,league_id,user_id,role,joined_at")
    .single();

  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  return Response.json({ member, invited }, { status: 201 });
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
