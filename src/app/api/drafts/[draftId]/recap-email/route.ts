import { Resend } from "resend";
import { createDraftRecapEmail, buildDraftRecap } from "@/lib/draftRecap";
import { TRANSACTIONAL_FROM } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DraftStatus, Pick, PlayerPosition, Team } from "@/types/draft";

interface RouteContext {
  params: Promise<{ draftId: string }>;
}

interface DraftRow {
  id: string;
  name: string;
  commissioner_user_id: string;
  league_id: string | null;
  status: DraftStatus;
}

interface LeagueRow {
  name: string;
  slug: string;
}

interface TeamRow {
  id: string;
  draft_id: string;
  name: string;
  draft_position: number;
  owner_name: string | null;
}

interface PickRow {
  id: string;
  draft_id: string;
  team_id: string;
  player_id: string;
  participant_id: string | null;
  round: number;
  pick_number: number;
  overall_pick_number: number;
  is_landmine: boolean;
  created_at: string;
  players: {
    full_name: string;
    position: PlayerPosition;
    nfl_team: string | null;
  } | {
    full_name: string;
    position: PlayerPosition;
    nfl_team: string | null;
  }[];
}

export async function POST(request: Request, { params }: RouteContext) {
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

  const { draftId } = await params;
  const { data: draft, error: draftError } = await supabaseAdmin
    .from("drafts")
    .select("id,name,commissioner_user_id,league_id,status")
    .eq("id", draftId)
    .maybeSingle();

  if (draftError) {
    return Response.json({ error: draftError.message }, { status: 500 });
  }

  if (!draft) {
    return Response.json({ error: "Draft not found." }, { status: 404 });
  }

  const draftRow = draft as DraftRow;
  if (draftRow.commissioner_user_id !== userData.user.id) {
    return Response.json(
      { error: "Only the commissioner can email the draft recap." },
      { status: 403 }
    );
  }

  if (draftRow.status !== "complete") {
    return Response.json(
      { error: "Draft recaps can only be emailed after the draft is complete." },
      { status: 409 }
    );
  }

  const [teamsResult, picksResult, leagueResult] = await Promise.all([
    supabaseAdmin
      .from("teams")
      .select("id,draft_id,name,draft_position,owner_name")
      .eq("draft_id", draftId)
      .order("draft_position"),
    supabaseAdmin
      .from("picks")
      .select(
        "id,draft_id,team_id,player_id,participant_id,round,pick_number,overall_pick_number,is_landmine,created_at,players(full_name,position,nfl_team)"
      )
      .eq("draft_id", draftId)
      .order("overall_pick_number"),
    draftRow.league_id
      ? supabaseAdmin
          .from("leagues")
          .select("name,slug")
          .eq("id", draftRow.league_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (teamsResult.error) {
    return Response.json({ error: teamsResult.error.message }, { status: 500 });
  }

  if (picksResult.error) {
    return Response.json({ error: picksResult.error.message }, { status: 500 });
  }

  if (leagueResult.error) {
    return Response.json({ error: leagueResult.error.message }, { status: 500 });
  }

  const league = leagueResult.data as LeagueRow | null;
  const teams = (teamsResult.data as TeamRow[]).map(mapTeam);
  const picks = (picksResult.data as unknown as PickRow[]).map(mapPick);
  const recipients = await getRecapRecipients({
    draftId,
    commissionerUserId: draftRow.commissioner_user_id,
    leagueId: draftRow.league_id,
  });

  if (recipients.error) {
    return Response.json({ error: recipients.error }, { status: 500 });
  }

  if (recipients.emails.length === 0) {
    return Response.json(
      { error: "No league member email addresses were found." },
      { status: 404 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "RESEND_API_KEY is not configured." },
      { status: 503 }
    );
  }

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const draftPath = league
    ? `/draft?draftId=${draftId}&leagueSlug=${league.slug}`
    : `/draft?draftId=${draftId}`;
  const draftUrl = new URL(draftPath, siteOrigin).toString();
  const recap = buildDraftRecap({
    draftName: draftRow.name,
    leagueName: league?.name ?? null,
    teams,
    picks,
  });
  const { subject, html, text } = createDraftRecapEmail({ recap, draftUrl });
  const resend = new Resend(apiKey);

  for (const email of recipients.emails) {
    const { error } = await resend.emails.send({
      from: TRANSACTIONAL_FROM,
      to: email,
      subject,
      html,
      text,
    });

    if (error) {
      return Response.json(
        { error: `Email delivery failed: ${error.message}` },
        { status: 502 }
      );
    }
  }

  return Response.json({
    sentCount: recipients.emails.length,
  });
}

async function getRecapRecipients({
  draftId,
  commissionerUserId,
  leagueId,
}: {
  draftId: string;
  commissionerUserId: string;
  leagueId: string | null;
}): Promise<{ emails: string[]; error: string | null }> {
  const userIds = new Set([commissionerUserId]);

  if (leagueId) {
    const { data, error } = await supabaseAdmin
      .from("league_members")
      .select("user_id")
      .eq("league_id", leagueId);

    if (error) return { emails: [], error: error.message };
    for (const row of data as { user_id: string }[]) {
      userIds.add(row.user_id);
    }
  } else {
    const { data, error } = await supabaseAdmin
      .from("draft_participants")
      .select("user_id")
      .eq("draft_id", draftId);

    if (error) return { emails: [], error: error.message };
    for (const row of data as { user_id: string }[]) {
      userIds.add(row.user_id);
    }
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) return { emails: [], error: error.message };

  const emails = data.users
    .filter((user) => userIds.has(user.id) && user.email)
    .map((user) => user.email!)
    .filter((email, index, all) => all.indexOf(email) === index);

  return { emails, error: null };
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    draftId: row.draft_id,
    name: row.name,
    draftPosition: row.draft_position,
    ownerName: row.owner_name ?? undefined,
  };
}

function mapPick(row: PickRow): Pick {
  const player = Array.isArray(row.players) ? row.players[0] : row.players;

  return {
    id: row.id,
    draftId: row.draft_id,
    teamId: row.team_id,
    playerId: row.player_id,
    participantId: row.participant_id ?? undefined,
    round: row.round,
    pickNumber: row.pick_number,
    overallPickNumber: row.overall_pick_number,
    playerName: player.full_name,
    playerPosition: player.position,
    nflTeam: player.nfl_team ?? undefined,
    isLandmine: row.is_landmine ?? false,
    createdAt: row.created_at,
  };
}
