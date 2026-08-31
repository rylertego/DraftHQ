import type { TeamGrade } from "@/lib/draftGrading";
import type { Pick, Team } from "@/types/draft";

const SITE_URL = "https://draft-hq.vercel.app";
const LOGO_URL = `${SITE_URL}/branding/logo-primary.png`;

export interface DraftRecapPick {
  id: string;
  label: string;
  round: number;
  pickNumber: number;
  overallPickNumber: number;
  playerName: string;
  playerPosition: string;
  nflTeam: string;
}

export interface DraftRecapTeam {
  teamId: string;
  teamName: string;
  ownerName: string | null;
  draftPosition: number;
  grade: string | null;
  score: number | null;
  picks: DraftRecapPick[];
}

export interface DraftRecapHighlight {
  label: string;
  value: string;
  detail: string;
}

export interface DraftRecap {
  draftName: string;
  leagueName: string | null;
  totalPicks: number;
  totalTeams: number;
  teamRecaps: DraftRecapTeam[];
  highlights: DraftRecapHighlight[];
}

export function buildDraftRecap({
  draftName,
  leagueName,
  teams,
  picks,
  teamGrades = null,
}: {
  draftName: string;
  leagueName?: string | null;
  teams: Team[];
  picks: Pick[];
  teamGrades?: TeamGrade[] | null;
}): DraftRecap {
  const picksByTeam = new Map<string, Pick[]>();
  for (const pick of picks) {
    const teamPicks = picksByTeam.get(pick.teamId) ?? [];
    teamPicks.push(pick);
    picksByTeam.set(pick.teamId, teamPicks);
  }

  const gradesByTeam = new Map(
    (teamGrades ?? []).map((grade) => [grade.teamId, grade])
  );

  const teamRecaps = [...teams]
    .sort((first, second) => first.draftPosition - second.draftPosition)
    .map((team) => {
      const grade = gradesByTeam.get(team.id);
      const teamPicks = [...(picksByTeam.get(team.id) ?? [])].sort(
        (first, second) => first.overallPickNumber - second.overallPickNumber
      );

      return {
        teamId: team.id,
        teamName: team.name,
        ownerName: team.ownerName ?? null,
        draftPosition: team.draftPosition,
        grade: grade?.grade ?? null,
        score: grade?.score ?? null,
        picks: teamPicks.map(formatPick),
      };
    });

  return {
    draftName,
    leagueName: leagueName ?? null,
    totalPicks: picks.length,
    totalTeams: teams.length,
    teamRecaps,
    highlights: buildHighlights(teamGrades ?? []),
  };
}

export function createDraftRecapEmail({
  recap,
  draftUrl,
}: {
  recap: DraftRecap;
  draftUrl: string;
}) {
  const subject = `${recap.draftName} recap is ready`;
  const leagueLine = recap.leagueName
    ? `<p style="margin:0 0 18px;font-size:15px;color:#94a3b8;line-height:1.6;">${escapeHtml(recap.leagueName)} wrapped with ${recap.totalPicks} picks across ${recap.totalTeams} teams.</p>`
    : `<p style="margin:0 0 18px;font-size:15px;color:#94a3b8;line-height:1.6;">Your draft wrapped with ${recap.totalPicks} picks across ${recap.totalTeams} teams.</p>`;

  const highlights = recap.highlights.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">${recap.highlights.map((highlight) => `
        <tr>
          <td style="padding:10px 0;border-top:1px solid #334155;">
            <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#22D3EE;">${escapeHtml(highlight.label)}</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:800;color:#f8fafc;">${escapeHtml(highlight.value)}</p>
            <p style="margin:2px 0 0;font-size:13px;color:#94a3b8;">${escapeHtml(highlight.detail)}</p>
          </td>
        </tr>`).join("")}</table>`
    : "";

  const teamRows = recap.teamRecaps.map((team) => `
    <tr>
      <td style="padding:14px 0;border-top:1px solid #334155;">
        <p style="margin:0;font-size:15px;font-weight:900;color:#f8fafc;">
          ${escapeHtml(team.teamName)}
          ${team.grade ? `<span style="color:#22D3EE;">${escapeHtml(team.grade)}</span>` : ""}
        </p>
        <p style="margin:3px 0 8px;font-size:12px;color:#94a3b8;">${escapeHtml(team.ownerName ?? "No owner assigned")}</p>
        <p style="margin:0;font-size:13px;color:#cbd5e1;line-height:1.55;">${team.picks.map((pick) => escapeHtml(pick.label)).join("<br />")}</p>
      </td>
    </tr>`).join("");

  const body = `
    <h1 style="margin:0 0 16px;font-size:30px;font-weight:900;color:#f8fafc;line-height:1.15;">
      ${escapeHtml(recap.draftName)} recap
    </h1>
    ${leagueLine}
    ${highlights}
    <table width="100%" cellpadding="0" cellspacing="0">${teamRows}</table>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(draftUrl)}" style="display:inline-block;background:#22D3EE;color:#000000;font-weight:900;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.01em;"><font color="#000000"><span style="color:#000000;font-weight:900;">Open Draft Recap</span></font></a>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-size:12px;color:#64748b;text-align:center;line-height:1.6;">
      Or copy this link into your browser:<br />
      <a href="${escapeHtml(draftUrl)}" style="color:#22D3EE;word-break:break-all;">${escapeHtml(draftUrl)}</a>
    </p>`;
  const html = emailLayout(subject, "Draft Recap", body);

  const text = [
    `${recap.draftName} recap`,
    recap.leagueName ? `${recap.leagueName}` : null,
    `${recap.totalPicks} picks across ${recap.totalTeams} teams.`,
    "",
    ...recap.highlights.map(
      (highlight) => `${highlight.label}: ${highlight.value} (${highlight.detail})`
    ),
    recap.highlights.length > 0 ? "" : null,
    ...recap.teamRecaps.flatMap((team) => [
      `${team.teamName}${team.ownerName ? ` - ${team.ownerName}` : ""}${team.grade ? ` - ${team.grade}` : ""}`,
      ...team.picks.map((pick) => `  ${pick.label}`),
      "",
    ]),
    `Open recap: ${draftUrl}`,
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

function buildHighlights(teamGrades: TeamGrade[]): DraftRecapHighlight[] {
  const topGrade = [...teamGrades].sort(
    (first, second) => second.score - first.score
  )[0];

  if (!topGrade) return [];

  return [
    {
      label: "Top graded draft",
      value: topGrade.teamName,
      detail: `${topGrade.grade} - ${Math.round(topGrade.score)}`,
    },
  ];
}

function formatPick(pick: Pick): DraftRecapPick {
  const nflTeam = pick.nflTeam ?? "FA";
  return {
    id: pick.id,
    label: `${pick.round}.${pick.pickNumber} ${pick.playerName} ${pick.playerPosition} ${nflTeam}`,
    round: pick.round,
    pickNumber: pick.pickNumber,
    overallPickNumber: pick.overallPickNumber,
    playerName: pick.playerName,
    playerPosition: pick.playerPosition,
    nflTeam,
  };
}

function emailLayout(title: string, eyebrow: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en" bgcolor="#0f172a">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body bgcolor="#0f172a" style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0f172a" style="background:#0f172a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="${LOGO_URL}" alt="DraftHQ" width="260" style="display:block;height:auto;" />
            </td>
          </tr>
          <tr>
            <td bgcolor="#1e293b" style="background:#1e293b;border-radius:16px;border:1px solid #334155;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#22D3EE;">${escapeHtml(eyebrow)}</p>
              ${body}
              <hr style="margin:32px 0;border:none;border-top:1px solid #334155;" />
              <p style="margin:0;font-size:11px;color:#64748b;text-align:center;">
                Sent by DraftHQ
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

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
