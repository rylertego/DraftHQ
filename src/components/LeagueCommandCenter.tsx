"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { getLeagueTeamDraftSlot, getLeagueTeams } from "@/lib/leagueApi";
import { buildOwnerDashboardView } from "@/lib/ownerDashboard";
import type { LeagueSeason, LeagueTeam, LeagueWorkspace } from "@/types/league";

type DraftStatus = "setup" | "active" | "paused" | "complete" | null;
type Tone = "neutral" | "live" | "ready" | "warning" | "danger" | "complete";

function formatDraftDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPickClock(seconds: number) {
  if (seconds === 0) return "Off";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function draftLifecycleLabel(status: LeagueSeason["status"] | undefined, draftStatus?: DraftStatus) {
  if (!status) return "No season";
  // Without a draft there is no draft status to report. Falling through to the
  // season's own status here is what made an un-created draft read as "active".
  if (!draftStatus) return "Not created";
  if (draftStatus === "setup") return "Pre-Draft";
  if (draftStatus === "active") return "Live";
  if (draftStatus === "paused") return "Paused";
  if (draftStatus === "complete") return "Complete";
  return status;
}

function statusTone(label: string): Tone {
  if (label === "Live" || label === "Drafting") return "live";
  if (label === "Paused") return "warning";
  if (label === "Complete") return "complete";
  if (label === "No draft" || label === "No season" || label === "Not created") return "warning";
  if (label === "Pre-Draft") return "ready";
  return "neutral";
}

function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const classes: Record<Tone, string> = {
    neutral: "border-slate-700 bg-slate-800/70 text-slate-300",
    live: "border-teal-400/35 bg-teal-400/12 text-teal-200",
    ready: "border-blue-400/35 bg-blue-500/12 text-blue-200",
    warning: "border-amber-400/35 bg-amber-500/12 text-amber-200",
    danger: "border-red-400/35 bg-red-500/12 text-red-200",
    complete: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${classes[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function SectionPanel({
  title,
  eyebrow,
  children,
  className = "",
  action,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-slate-800/90 bg-slate-900/72 shadow-[0_18px_50px_rgba(0,0,0,0.22)] ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
        <div>
          {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>}
          <h2 className="mt-1 text-base font-bold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}) {
  const toneClass: Record<Tone, string> = {
    neutral: "text-white",
    live: "text-teal-200",
    ready: "text-blue-200",
    warning: "text-amber-200",
    danger: "text-red-200",
    complete: "text-emerald-200",
  };

  return (
    <div className="rounded-xl bg-slate-950/35 px-4 py-3 ring-1 ring-white/10">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black tabular-nums ${toneClass[tone]}`}>{value}</p>
      {detail && <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function TeamMark({ src, name, className = "h-12 w-12", accentColor }: { src?: string | null; name: string; className?: string; accentColor: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950/70 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain p-1" />
      ) : (
        <span className="text-sm font-black uppercase" style={{ color: accentColor }}>
          {name.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

function Countdown({
  scheduledAt,
  status,
  accentColor,
}: {
  scheduledAt: string | null;
  status: DraftStatus;
  accentColor: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Ticks every second so the clock actually counts down. `now` starts null
    // so the server and first client render agree before the timer takes over.
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  if (!scheduledAt) return null;

  if (status === "complete") {
    return (
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
        <p className="text-sm font-bold text-emerald-100">Draft complete</p>
        <p className="mt-1 text-sm text-slate-400">{formatDraftDate(scheduledAt)}</p>
      </div>
    );
  }

  if (status === "active" || status === "paused") {
    return (
      <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}12` }}>
        <p className="text-sm font-bold text-white">{status === "paused" ? "Draft paused" : "Draft underway"}</p>
        <p className="mt-1 text-sm text-slate-400">{formatDraftDate(scheduledAt)}</p>
      </div>
    );
  }

  const remaining = now === null ? null : Math.max(0, new Date(scheduledAt).getTime() - now);
  if (remaining === 0) {
    return (
      <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
        <p className="text-sm font-bold text-amber-100">Draft time has arrived</p>
        <p className="mt-1 text-sm text-slate-400">{formatDraftDate(scheduledAt)}</p>
      </div>
    );
  }

  const totalSeconds = remaining === null ? 0 : Math.floor(remaining / 1_000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  // Days only earn their place once there are any; inside the last day the
  // clock reads like a countdown rather than a mostly-zero row.
  const clock =
    days > 0
      ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const imminent = totalSeconds < 3_600;

  return (
    <div>
      <p
        className="font-mono text-3xl font-black tabular-nums leading-none sm:text-4xl"
        style={{ color: imminent ? "#fbbf24" : accentColor }}
        aria-live="off"
      >
        {now === null ? "--:--:--" : clock}
      </p>
      <p className="mt-2 text-xs font-medium text-slate-400">{formatDraftDate(scheduledAt)}</p>
    </div>
  );
}

function ReadinessItem({
  label,
  detail,
  done,
}: {
  label: string;
  detail: string;
  done: boolean | null;
}) {
  const state =
    done === null
      ? { label: "Checking", className: "border-slate-700 bg-slate-800 text-slate-400" }
      : done
        ? { label: "Done", className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" }
        : { label: "Open", className: "border-amber-400/25 bg-amber-500/10 text-amber-300" };

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-3 border-b border-slate-800/70 py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p>
      </div>
      <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${state.className}`}>
        {state.label}
      </span>
    </div>
  );
}

function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/35 px-4 py-5">
      <p className="text-sm font-bold text-slate-200">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">{detail}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default function LeagueCommandCenter({
  workspace,
  slug,
  onConfigureDraft,
  onResetDraft,
}: {
  workspace: LeagueWorkspace;
  slug: string;
  onConfigureDraft: () => void;
  onResetDraft: () => void;
}) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState("");
  const [myDraftSlot, setMyDraftSlot] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void getLeagueTeams(workspace.league.id)
      .then((result) => {
        if (active) {
          setTeams(result);
          setTeamsError("");
        }
      })
      .catch((error) => {
        if (active) setTeamsError(error instanceof Error ? error.message : "Unable to load teams.");
      })
      .finally(() => {
        if (active) setTeamsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace.league.id]);

  const [currentSeason] = workspace.seasons;
  const draft = currentSeason?.draft;
  const activeTeams = teams.filter((team) => !team.archivedAt);
  const assignedOwners = activeTeams.filter((team) => team.ownerUserId).length;
  const expectedTeams = draft?.teamCount ?? workspace.league.teamCount;
  const teamsReady = activeTeams.length === expectedTeams;
  const ownersReady = activeTeams.length > 0 && assignedOwners === activeTeams.length;
  const draftCreated = Boolean(draft);
  const draftScheduled = Boolean(draft?.scheduledAt);
  const configureHref = draft ? `/teams?draftId=${draft.id}&tab=settings&leagueSlug=${slug}` : null;
  const draftLabel = draftLifecycleLabel(currentSeason?.status, draft?.status ?? null);
  const draftTone = statusTone(draftLabel);
  const isOwnerView = !workspace.canManage;
  const myTeamId = workspace.myTeam?.id ?? null;
  const currentSeasonId = currentSeason?.id ?? null;

  useEffect(() => {
    // Owners are the only ones who see their own slot; commissioners get the
    // full order on the teams page. Fails soft — a missing slot reads as TBD.
    if (!isOwnerView || !myTeamId || !currentSeasonId) return;
    let active = true;
    void getLeagueTeamDraftSlot(currentSeasonId, myTeamId)
      .then((slot) => {
        if (active) setMyDraftSlot(slot);
      })
      .catch(() => {
        if (active) setMyDraftSlot(null);
      });
    return () => {
      active = false;
    };
  }, [isOwnerView, myTeamId, currentSeasonId]);

  const readinessItems: Array<{ label: string; done: boolean | null; detail: string }> = [
    { label: "League created", done: true, detail: workspace.league.name },
    { label: "Draft created", done: draftCreated, detail: draft ? draft.name : "Create this season's draft" },
    { label: "Draft date set", done: draftScheduled, detail: draft?.scheduledAt ? formatDraftDate(draft.scheduledAt) : "Schedule the draft" },
    { label: "Teams added", done: teamsLoading ? null : teamsReady, detail: teamsLoading ? "Checking teams" : `${activeTeams.length} of ${expectedTeams} teams` },
    { label: "Owners assigned", done: teamsLoading ? null : ownersReady, detail: teamsLoading ? "Checking owners" : `${assignedOwners} of ${activeTeams.length} assigned` },
    {
      label: "Draft room ready",
      done: teamsLoading ? null : draftCreated && draftScheduled && teamsReady && ownersReady,
      detail: draftCreated && draftScheduled && teamsReady && ownersReady ? "Ready to open" : "Finish setup first",
    },
  ];

  const openItems = readinessItems.filter((item) => item.done === false).length;
  const completedItems = readinessItems.filter((item) => item.done === true).length;
  const readinessPercent = Math.round((completedItems / readinessItems.length) * 100);
  const setupReady = openItems === 0 && !teamsLoading && !teamsError;
  const setupLabel = setupReady && draft?.status === "complete"
    ? "Draft Complete"
    : setupReady
      ? "Ready"
      : teamsError
        ? "Needs Attention"
        : `${readinessPercent}% Ready`;
  const setupTone: Tone = setupReady ? "complete" : "warning";
  const scheduledDraftDate = draft?.scheduledAt ? formatDraftDate(draft.scheduledAt) : "";
  const setupSummary = setupReady && draft?.status === "complete"
    ? "The draft is complete. Review results and keep the league record current."
    : teamsError
      ? "Team data could not be loaded. Resolve the issue before relying on readiness status."
      : !draftCreated
        ? "Create this season's draft so commissioners can configure the room."
        : !draftScheduled
          ? "Draft setup is underway. Schedule the start time before owners arrive."
          : !teamsReady
            ? "Draft setup is underway. Align the team count with league settings before draft night."
            : !ownersReady
              ? "Draft setup is underway. Assign every team to an owner before draft night."
              : `Draft night is scheduled for ${scheduledDraftDate}.`;
  const lastCompletedSeason = workspace.seasons.find(
    (season) => season.status === "complete" && season.standings.length > 0
  );
  const champion = lastCompletedSeason?.standings.find(
    (standing) => standing.leagueTeamId === lastCompletedSeason.championTeamId
  ) ?? null;
  const leagueStandings = lastCompletedSeason?.standings ?? [];
  const lastPlace = leagueStandings.length > 0
    ? leagueStandings.reduce((worst, standing) => standing.finalRank > worst.finalRank ? standing : worst, leagueStandings[0])
    : null;
  const previousLeagueYear = currentSeason?.year ? currentSeason.year - 1 : lastCompletedSeason?.year;
  const recentMembers = [...workspace.members]
    .sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt))
    .slice(0, 3);

  const secondaryButtonClass = "inline-flex items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/60 px-5 py-3 text-sm font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950";
  const teamSetupHref = `/leagues/${slug}/teams`;
  const ownerView = buildOwnerDashboardView({
    draftExists: draftCreated,
    draftStatus: draft?.status ?? null,
    formattedDraftDate: draft?.scheduledAt ? formatDraftDate(draft.scheduledAt) : null,
    hasTeam: Boolean(workspace.myTeam),
    teamName: workspace.myTeam?.name ?? null,
    draftSlot: myDraftSlot,
    teamCount: expectedTeams,
  });
  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-5">
      <section
        className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/75 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
        aria-labelledby="league-dashboard-title"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background: `linear-gradient(135deg, ${secondary} 0%, rgba(15,23,42,0.82) 48%, #020617 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ backgroundColor: primary }}
        />
        {workspace.canManage && draft && (
          <button
            type="button"
            onClick={onResetDraft}
            className="absolute right-5 top-5 z-10 text-xs font-semibold text-red-400/80 transition-colors hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-950 lg:right-6 lg:top-6"
          >
            Reset draft
          </button>
        )}
        {isOwnerView && workspace.myTeam && (
          <div className="absolute right-5 top-5 z-10 lg:right-6 lg:top-6">
            <TeamMark
              src={workspace.myTeam.logoUrl}
              name={ownerView.teamLabel}
              className="h-16 w-16"
              accentColor={primary}
            />
          </div>
        )}
        <div className="relative grid gap-5 p-5 lg:p-6">
          <div className="min-w-0">
            <div className="mb-5 flex items-center gap-3 lg:hidden">
              <TeamMark src={workspace.league.logoUrl} name={workspace.league.name} className="h-14 w-14" accentColor={primary} />
              <div className="min-w-0">
                <p className="truncate text-base font-black text-white">{workspace.league.name}</p>
                <p className="mt-0.5 text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: primary }}>
                  {workspace.members.length} members
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: primary }}>
                {isOwnerView ? "Draft Night" : "League Command Center"}
              </p>
              <StatusBadge
                label={isOwnerView ? ownerView.statusLabel : setupLabel}
                tone={isOwnerView ? ownerView.statusTone : setupTone}
              />
            </div>
            <div className="mt-3 flex flex-col gap-3 pr-24 sm:flex-row sm:items-center">
              <h1 id="league-dashboard-title" className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                {currentSeason?.name ?? `${new Date().getFullYear()} Season`}
              </h1>
              {workspace.canManage && (
                draft ? (
                  <Link href={configureHref ?? teamSetupHref} className={secondaryButtonClass}>
                    Configure Draft
                  </Link>
                ) : currentSeason ? (
                  <button type="button" onClick={onConfigureDraft} className={secondaryButtonClass}>
                    Create Draft
                  </button>
                ) : (
                  <Link href={`/leagues/${slug}/seasons/new`} className={secondaryButtonClass}>
                    Create Season
                  </Link>
                )
              )}
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {isOwnerView ? ownerView.headline : setupSummary}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {isOwnerView ? (
                <>
                  <MetricTile label="Draft Status" value={draftLabel} detail={draft?.name ?? "Season setup"} tone={draftTone} />
                  <MetricTile label="Your Pick" value={ownerView.slotLabel} detail="Draft slot" tone={myDraftSlot === null ? "warning" : "neutral"} />
                  <MetricTile label="Pick Clock" value={draft ? formatPickClock(draft.pickSeconds) : "--"} detail="Per pick" />
                  <MetricTile label="League" value={String(workspace.members.length)} detail="Members" />
                </>
              ) : (
                <>
                  <MetricTile label="Readiness" value={setupLabel} detail={draft?.name ?? "Season setup"} tone={setupTone} />
                  <MetricTile label="Draft Status" value={draftLabel} detail={draft?.name ?? "Season setup"} tone={draftTone} />
                  <MetricTile label="Teams" value={teamsLoading ? "--" : `${activeTeams.length}/${expectedTeams}`} detail={teamsReady ? "Roster count ready" : "Match league size"} tone={teamsReady ? "complete" : "warning"} />
                  <MetricTile label="Owners" value={teamsLoading ? "--" : `${assignedOwners}/${activeTeams.length}`} detail={ownersReady ? "All assigned" : "Assignments needed"} tone={ownersReady ? "complete" : "warning"} />
                </>
              )}
            </div>

            <div className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/35 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Next Event</p>
                    <h2 className="mt-1 text-base font-bold text-white">Draft Countdown</h2>
                  </div>
                  {workspace.canManage && draft && !draft.scheduledAt && (
                    <Link href={configureHref ?? teamSetupHref} className="inline-flex rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-slate-950 transition-colors hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-slate-950">
                      Schedule Draft
                    </Link>
                  )}
                </div>
                {draft?.scheduledAt && (
                  <StatusBadge label={draftLabel} tone={draftTone} />
                )}
              </div>
              <div className={draft?.scheduledAt ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.75fr)] lg:items-end" : "grid gap-3 sm:grid-cols-3"}>
                {draft?.scheduledAt && (
                  <Countdown
                    scheduledAt={draft.scheduledAt}
                    status={draft.status}
                    accentColor={primary}
                  />
                )}
                <div className={draft?.scheduledAt ? "grid gap-3 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3" : "contents"}>
                  <MetricTile label="Rounds" value={draft ? String(draft.rounds) : "--"} detail="Draft length" />
                  <MetricTile label="Pick Clock" value={draft ? formatPickClock(draft.pickSeconds) : "--"} detail="Per pick" />
                  <MetricTile label="Expiry" value={draft?.timerBehavior === "auto_draft" ? "Auto" : draft?.timerBehavior === "skip" ? "Skip" : draft ? "Hold" : "--"} detail="Clock behavior" />
                </div>
              </div>
            </div>
          </div>

        </div>

        {teamsError && (
          <p className="relative mx-5 mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 lg:mx-6">
            Team snapshot unavailable: {teamsError}
          </p>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.38fr)]">
        {/*
          <SectionPanel title="Draft Countdown" eyebrow="Next event">
            <div className="space-y-4">
              <Countdown
                scheduledAt={draft?.scheduledAt ?? null}
                status={draft?.status ?? null}
                accentColor={primary}
                unscheduledTitle={isOwnerView ? (draftCreated ? "Draft date not set yet" : "No draft yet") : undefined}
                unscheduledDetail={isOwnerView
                  ? (draftCreated
                      ? "Your commissioner hasn't locked the start time. The countdown starts here the moment they do."
                      : "This season's draft hasn't been opened yet. Check back — the countdown lands here first.")
                  : undefined}
                action={workspace.canManage && draft ? (
                  <Link href={configureHref ?? teamSetupHref} className="inline-flex rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-slate-950 transition-colors hover:bg-amber-200">
                    Schedule Draft
                  </Link>
                ) : undefined}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricTile label="Rounds" value={draft ? String(draft.rounds) : "--"} detail="Draft length" />
                <MetricTile label="Pick Clock" value={draft ? formatPickClock(draft.pickSeconds) : "--"} detail="Per pick" />
                <MetricTile label="Expiry" value={draft?.timerBehavior === "auto_draft" ? "Auto" : draft?.timerBehavior === "skip" ? "Skip" : draft ? "Hold" : "--"} detail="Clock behavior" />
              </div>
            </div>
          </SectionPanel>
        */}

        <SectionPanel title="League Standings" eyebrow={lastCompletedSeason ? `${lastCompletedSeason.year} final table` : "Final table"}>
          {lastCompletedSeason ? (
            <div className="overflow-hidden rounded-xl border border-slate-800">
              {leagueStandings.map((standing) => (
                <div key={standing.leagueTeamId} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-800 bg-slate-950/30 px-3 py-3 last:border-0">
                  <span className={`text-center text-sm font-black tabular-nums ${standing.finalRank === 1 ? "text-amber-300" : "text-slate-500"}`}>
                    {standing.finalRank}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-100">{standing.teamName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{standing.pointsFor.toLocaleString()} PF</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-slate-400">
                    {standing.wins}-{standing.losses}{standing.ties ? `-${standing.ties}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No standings yet"
              detail="Import Sleeper history or complete a season to give this league a historical record."
              action={workspace.canManage ? (
                <Link href={`/leagues/${slug}/settings?tab=integrations`} className="text-sm font-bold" style={{ color: primary }}>
                  Connect Sleeper
                </Link>
              ) : undefined}
            />
          )}
        </SectionPanel>

        <div className="grid gap-5">
          <SectionPanel title={previousLeagueYear ? `${previousLeagueYear} Champion` : "Champion"} eyebrow="League history">
            {champion && lastCompletedSeason ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <TeamMark src={champion.teamLogoUrl} name={champion.teamName} className="h-36 w-36" accentColor={primary} />
                <p className="mt-4 text-xl font-black text-white">{champion.teamName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {champion.wins}-{champion.losses}{champion.ties ? `-${champion.ties}` : ""}
                </p>
              </div>
            ) : (
              <EmptyState title="No champion yet" detail="The champion spotlight will unlock after a completed season is connected." />
            )}
          </SectionPanel>

          <SectionPanel title={previousLeagueYear ? `${previousLeagueYear} Loser` : "Loser"} eyebrow="League history">
            {lastPlace && champion && lastPlace.leagueTeamId !== champion.leagueTeamId ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <TeamMark src={lastPlace.teamLogoUrl} name={lastPlace.teamName} className="h-36 w-36" accentColor={primary} />
                <p className="mt-4 text-xl font-black text-white">{lastPlace.teamName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {lastPlace.wins}-{lastPlace.losses}{lastPlace.ties ? `-${lastPlace.ties}` : ""}
                </p>
              </div>
            ) : (
              <EmptyState title="No loser yet" detail="The last-place spotlight will unlock after standings are connected." />
            )}
          </SectionPanel>
        </div>
      </div>

      <div className={`grid gap-5 ${isOwnerView ? "xl:grid-cols-[minmax(280px,0.45fr)]" : "xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]"}`}>
        {!isOwnerView && (
          <SectionPanel
            title="Draft Readiness"
            eyebrow={`${openItems} open item${openItems === 1 ? "" : "s"}`}
            action={<StatusBadge label={openItems === 0 ? "Ready" : "Needs Work"} tone={openItems === 0 ? "complete" : "warning"} />}
          >
            <div className="space-y-1">
              {readinessItems.map((item) => (
                <ReadinessItem key={item.label} {...item} />
              ))}
            </div>
          </SectionPanel>
        )}

        <SectionPanel title="League Activity" eyebrow="Recent updates" className={isOwnerView ? "xl:max-w-md" : ""}>
          {recentMembers.length === 0 ? (
            <EmptyState title="No activity yet" detail="Member activity will appear as owners join and league history is imported." />
          ) : (
            <div className="space-y-2">
              {recentMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-2">
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-black text-slate-400">
                      {(member.nickname || member.displayName).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {member.nickname || member.displayName}
                      <span className="font-normal text-slate-500"> joined</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatShortDate(member.joinedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </div>
  );
}
