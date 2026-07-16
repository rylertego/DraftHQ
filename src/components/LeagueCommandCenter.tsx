"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { getLeagueTeams } from "@/lib/leagueApi";
import type { LeagueSeason, LeagueTeam, LeagueWorkspace } from "@/types/league";

function StatusBadge({ status, draftStatus }: { status: LeagueSeason["status"]; draftStatus?: string | null }) {
  const label =
    status === "drafting" && !draftStatus ? "No Draft" :
    draftStatus === "setup" ? "Pre-Draft" :
    draftStatus === "active" ? "Live" :
    draftStatus === "paused" ? "Paused" :
    draftStatus === "complete" ? "Complete" :
    status === "drafting" ? "Drafting" :
    status;
  const cls =
    label === "No Draft" ? "bg-slate-800 text-slate-400" :
    label === "Pre-Draft" ? "bg-slate-700/80 text-slate-300" :
    label === "Live" || label === "Drafting" ? "bg-emerald-900/60 text-emerald-300" :
    label === "Paused" ? "bg-yellow-900/60 text-yellow-300" :
    label === "Complete" ? "bg-slate-700 text-slate-300" :
    "bg-slate-800 text-slate-400";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}

function Card({ title, eyebrow, accentColor, children }: { title: string; eyebrow: string; accentColor: string; children: React.ReactNode }) {
  return (
    <section className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-slate-900/80 p-4 xl:p-3.5" style={{ borderColor: accentColor + "40" }}>
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 100% 0%, ${accentColor}18, transparent 55%)` }} />
      <p className="relative text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accentColor }}>{eyebrow}</p>
      <h2 className="relative mt-1 text-base font-bold text-white">{title}</h2>
      <div className="relative mt-3 min-h-0 flex-1 flex flex-col">{children}</div>
    </section>
  );
}

function formatDraftDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function formatPickClock(seconds: number) {
  if (seconds === 0) return "Off";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function Countdown({ scheduledAt, status, configureHref, canManage, accentColor }: {
  scheduledAt: string | null;
  status: "setup" | "active" | "paused" | "complete" | null;
  configureHref: string | null;
  canManage: boolean;
  accentColor: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  if (!scheduledAt) {
    return (
      <div className="flex min-h-32 flex-col justify-between">
        <div>
          <p className="font-semibold text-slate-300">Draft date not scheduled</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">Set a date and time so everyone knows when the room opens.</p>
        </div>
        {canManage && configureHref && <Link href={configureHref} className="mt-4 text-sm font-semibold transition-opacity hover:opacity-80" style={{ color: accentColor }}>Configure draft date →</Link>}
      </div>
    );
  }

  if (status === "complete") return <p className="min-h-32 text-2xl font-black text-emerald-400">Draft complete</p>;
  if (status === "active" || status === "paused") {
    return <div className="flex min-h-32 flex-col items-center justify-center text-center"><p className="text-2xl font-black" style={{ color: accentColor }}>Draft Underway</p><p className="mt-2 text-sm text-slate-400">{formatDraftDate(scheduledAt)}</p></div>;
  }

  const remaining = now === null ? null : Math.max(0, new Date(scheduledAt).getTime() - now);
  if (remaining === 0) return <div className="min-h-32"><p className="text-2xl font-black text-amber-400">Draft time has arrived</p><p className="mt-2 text-sm text-slate-400">{formatDraftDate(scheduledAt)}</p></div>;

  const totalMinutes = remaining === null ? 0 : Math.floor(remaining / 60_000);
  const values: Array<[number, string]> = [
    [Math.floor(totalMinutes / 1_440), "Days"],
    [Math.floor((totalMinutes % 1_440) / 60), "Hours"],
    [totalMinutes % 60, "Minutes"],
  ];
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {values.map(([value, label]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/60 px-2 py-3 text-center">
            <p className="text-2xl font-black tabular-nums text-white">{now === null ? "—" : value}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">{formatDraftDate(scheduledAt)}</p>
    </div>
  );
}

export default function LeagueCommandCenter({ workspace, slug, onConfigureDraft, onResetDraft }: {
  workspace: LeagueWorkspace;
  slug: string;
  onConfigureDraft: () => void;
  onResetDraft: () => void;
}) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState("");

  useEffect(() => {
    let active = true;
    void getLeagueTeams(workspace.league.id)
      .then((result) => {
        if (active) {
          setTeams(result);
          setTeamsError("");
        }
      })
      .catch((error) => { if (active) setTeamsError(error instanceof Error ? error.message : "Unable to load teams."); })
      .finally(() => { if (active) setTeamsLoading(false); });
    return () => { active = false; };
  }, [workspace.league.id]);

  const [currentSeason] = workspace.seasons;
  const recentMembers = [...workspace.members]
    .sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt))
    .slice(0, 6);
  const draft = currentSeason?.draft;
  const activeTeams = teams.filter((team) => !team.archivedAt);
  const assignedOwners = activeTeams.filter((team) => team.ownerUserId).length;
  const expectedTeams = draft?.teamCount ?? workspace.league.teamCount;
  const teamsReady = activeTeams.length === expectedTeams;
  const configureHref = draft ? `/teams?draftId=${draft.id}&tab=settings&leagueSlug=${slug}` : null;
  const roomHref = draft ? `/draft/lobby?draftId=${draft.id}&leagueSlug=${slug}` : null;
  const lastCompletedSeason = workspace.seasons.find(
    (season) => season.status === "complete" && season.standings.length > 0
  );
  const champion = lastCompletedSeason?.standings.find(
    (standing) => standing.leagueTeamId === lastCompletedSeason.championTeamId
  ) ?? null;
  const checklist: Array<{ label: string; done: boolean | null; detail: string }> = [
    { label: "League created", done: true, detail: workspace.league.name },
    { label: "Draft date set", done: Boolean(draft?.scheduledAt), detail: draft?.scheduledAt ? formatDraftDate(draft.scheduledAt) : "Schedule the draft" },
    { label: "Teams added", done: teamsLoading ? null : teamsReady, detail: teamsLoading ? "Checking teams" : `${activeTeams.length} of ${expectedTeams} teams` },
    { label: "Owners invited", done: teamsLoading ? null : activeTeams.length > 0 && assignedOwners === activeTeams.length, detail: teamsLoading ? "Checking owners" : `${assignedOwners} of ${activeTeams.length} assigned` },
    { label: "Draft order configured", done: teamsLoading ? null : Boolean(draft) && teamsReady, detail: draft ? "Snake order initialized" : "Create a draft first" },
    { label: "Draft room ready", done: teamsLoading ? null : Boolean(draft) && teamsReady, detail: draft ? (teamsReady ? "Ready to open" : "Finish adding teams") : "Draft not created" },
  ];

  return (
    <div className="space-y-6 xl:grid xl:h-full xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] xl:gap-4 xl:space-y-0 xl:overflow-hidden">
      <section className="relative overflow-hidden rounded-xl border bg-slate-900 px-4 py-3 sm:px-5" style={{ borderColor: primary + "66" }}>
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: `radial-gradient(circle at 85% 0%, ${primary}22, transparent 50%)` }} />
        <div className="relative flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: primary }}>Season Overview</p>
              {currentSeason && <StatusBadge status={currentSeason.status} draftStatus={draft?.status ?? null} />}
            </div>
            <h1 className="mt-0.5 text-xl font-black tracking-tight text-white">{currentSeason?.name ?? `${new Date().getFullYear()} Season`}</h1>
            <p className="mt-0.5 text-xs text-slate-400">{draft?.scheduledAt ? formatDraftDate(draft.scheduledAt) : draft ? "Draft date not scheduled." : "Create and configure this season's draft."}</p>
          </div>
          <div className="hidden xl:flex items-center gap-6 shrink-0">
            {([["Type", "Snake"], ["Teams", teamsLoading ? "—" : `${activeTeams.length} / ${expectedTeams}`], ["Members", String(workspace.members.length)], ["Status", draft?.status ?? "Not configured"]] as const).map(([label, value]) => (
              <div key={label} className="text-center">
                <p className="text-[10px] text-slate-500">{label}</p>
                <p className="mt-0.5 text-sm font-bold capitalize text-white">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {roomHref ? (
              <Link href={roomHref} className="rounded-xl px-4 py-2 text-sm font-black hover:opacity-90" style={{ backgroundColor: primary, color: secondary }}>Enter Draft Room</Link>
            ) : currentSeason && workspace.canManage ? (
              <button type="button" onClick={onConfigureDraft} className="rounded-xl px-4 py-2 text-sm font-black hover:opacity-90" style={{ backgroundColor: primary, color: secondary }}>Configure Draft</button>
            ) : workspace.canManage ? (
              <Link href={`/leagues/${slug}/seasons/new`} className="rounded-xl px-4 py-2 text-sm font-black hover:opacity-90" style={{ backgroundColor: primary, color: secondary }}>Create Season</Link>
            ) : null}
            {workspace.canManage && <Link href={configureHref ?? `/leagues/${slug}/teams`} className="rounded-xl border border-slate-700 bg-slate-950/30 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800/70">{configureHref ? "Configure Draft" : "Manage Teams"}</Link>}
            {workspace.canManage && draft && <button type="button" onClick={onResetDraft} className="text-xs text-red-600 hover:text-red-400 px-1">Reset Draft</button>}
          </div>
        </div>
        {teamsError && <p className="relative mt-2 rounded-lg border border-red-800 bg-red-950/30 px-3 py-1.5 text-xs text-red-400">Team snapshot unavailable: {teamsError}</p>}
      </section>

      {/* ── Middle row: Draft Countdown + Last Season Champion ── */}
      <div className="grid min-h-0 gap-4 lg:grid-cols-2">
        <Card accentColor={primary} title="Draft Countdown" eyebrow="Next event / At a glance">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <Countdown scheduledAt={draft?.scheduledAt ?? null} status={draft?.status ?? null} configureHref={configureHref} canManage={workspace.canManage} accentColor={primary} />
            <dl className="flex-1 grid grid-cols-3 auto-rows-fr gap-x-4 border-t border-slate-800/60 pt-3">
              {[
                ["Teams", teamsLoading ? "—" : `${activeTeams.length} / ${expectedTeams}`],
                ["Members", String(workspace.members.length)],
                ["Rounds", draft ? String(draft.rounds) : "—"],
                ["Pick clock", draft ? formatPickClock(draft.pickSeconds) : "—"],
                ["Draft type", "Snake"],
                ["Status", draft?.status ?? "None"],
              ].map(([label, value]) => <div key={label} className="flex flex-col justify-center text-center"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-0.5 text-base font-bold capitalize text-white">{value}</dd></div>)}
            </dl>
          </div>
        </Card>
        <Card accentColor={primary} title="Last Season Champion" eyebrow="League history">
          {champion && lastCompletedSeason ? (
            <div className="flex h-full min-h-0 items-center justify-center gap-8 px-6">
              <div className="aspect-square h-full max-h-48 shrink-0 overflow-hidden rounded-xl flex items-center justify-center">
                {champion.teamLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={champion.teamLogoUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-3xl font-black" style={{ color: primary }}>{champion.teamName.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-2xl font-black text-white">{champion.teamName}</p>
                <p className="mt-1.5 text-sm font-semibold" style={{ color: primary }}>{lastCompletedSeason.year} Season Champion</p>
                <p className="mt-1 text-sm text-slate-400">{champion.wins}-{champion.losses}{champion.ties ? `-${champion.ties}` : ""}</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-500">No completed seasons yet.</p>
              {workspace.canManage && <Link href={`/leagues/${slug}/settings?tab=integrations`} className="mt-3 inline-block text-xs font-semibold hover:opacity-80" style={{ color: primary }}>Connect Sleeper →</Link>}
            </div>
          )}
        </Card>
      </div>

      {/* ── Bottom row: Activity | Records | Standings (wide) | Checklist ── */}
      <div className={`grid gap-4 sm:grid-cols-2 ${workspace.canManage ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        <Card accentColor={primary} title="League Activity" eyebrow="Recent updates">
          {recentMembers.length === 0 ? (
            <p className="text-sm leading-relaxed text-slate-500">Member activity will appear here as people join the league.</p>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {recentMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-400">
                      {(member.nickname || member.displayName).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">
                      {member.nickname || member.displayName}
                      <span className="font-normal text-slate-500"> joined the league</span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(member.joinedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card accentColor={primary} title="League Records" eyebrow="All-time leaders"><p className="text-sm leading-relaxed text-slate-500">League records will unlock after drafts and seasons are completed.</p></Card>
        <div className="xl:col-span-2"><Card accentColor={primary} title="Last Season Standings" eyebrow={lastCompletedSeason ? `${lastCompletedSeason.year} final table` : "Final table"}>
          {lastCompletedSeason ? (
            <div>
              {lastCompletedSeason.standings.map((standing) => (
                <div key={standing.leagueTeamId} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 py-[7px] border-b border-slate-800/50 last:border-0">
                  <span className={`text-sm font-black tabular-nums ${standing.finalRank === 1 ? "text-amber-400" : "text-slate-500"}`}>{standing.finalRank}</span>
                  <span className="truncate text-sm font-semibold text-slate-200">{standing.teamName}</span>
                  <span className="text-sm tabular-nums text-slate-500">{standing.wins}-{standing.losses}{standing.ties ? `-${standing.ties}` : ""}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-slate-500">Standings will appear after the first completed season.</p>
          )}
        </Card></div>
        {workspace.canManage && (
          <Card accentColor={primary} title="Commissioner Checklist" eyebrow="League readiness">
            <div className="space-y-3">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3 border-b border-slate-800/70 pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0"><p className="text-sm font-semibold text-slate-200">{item.label}</p><p className="mt-0.5 truncate text-xs text-slate-500">{item.detail}</p></div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${item.done === null ? "bg-slate-800 text-slate-500" : item.done ? "bg-emerald-950 text-emerald-400" : "bg-amber-950 text-amber-400"}`}>{item.done === null ? "Checking" : item.done ? "Done" : "Open"}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

    </div>
  );
}
