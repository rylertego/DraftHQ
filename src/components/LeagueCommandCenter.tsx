"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { getLeagueTeamDraftSlot, getLeagueTeams } from "@/lib/leagueApi";
import { buildOwnerDashboardView } from "@/lib/ownerDashboard";
import type { LeagueSeason, LeagueTeam, LeagueWorkspace } from "@/types/league";
import { Button, LinkButton } from "@/components/ui";

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
  if (!draftStatus) return "Not Created";
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
  if (label === "No draft" || label === "No season" || label === "Not Created") return "warning";
  if (label === "Pre-Draft") return "ready";
  return "neutral";
}

/** One white heading per panel. The grey eyebrow above it was a second,
 *  quieter title saying roughly the same thing — "2025 Final Table" over
 *  "League Standings" — so the year now folds into the heading itself. */
function SectionPanel({
  title,
  children,
  className = "",
  action,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-slate-800/90 bg-slate-900/72 shadow-[0_18px_50px_rgba(0,0,0,0.22)] ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
        <h2 className="text-base font-bold text-white">{title}</h2>
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
  compact = false,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
  compact?: boolean;
}) {
  // Status renders in plain foreground text. Readiness, counts, and lifecycle
  // labels say what is true in words — tinting all of them amber/green meant
  // nearly every number on the dashboard was coloured, and the colour stopped
  // carrying information. Colour survives only where the spec reserves it:
  // a live draft, and genuine errors.
  const toneClass: Record<Tone, string> = {
    neutral: "text-white",
    live: "text-[color:var(--color-league-accent-hover)]",
    ready: "text-white",
    warning: "text-white",
    danger: "text-red-200",
    complete: "text-white",
  };

  return (
    <div className={`rounded-xl bg-slate-950/35 px-4 ring-1 ring-white/10 ${compact ? "py-2" : "py-3"}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 font-black tabular-nums ${compact ? "text-lg" : "text-xl"} ${toneClass[tone]}`}>{value}</p>
      {detail && <p className={`${compact ? "mt-0.5" : "mt-1"} truncate text-xs text-slate-500`}>{detail}</p>}
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
  const expectedTeams = draft?.teamCount ?? workspace.league.teamCount;
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

  const lastCompletedSeason = workspace.seasons.find(
    (season) => season.status === "complete" && season.standings.length > 0
  );
  // Standings carry the team but not who runs it, so resolve the owner from the
  // league team list. Undefined while teams are still loading, or when the
  // franchise has no owner assigned — both render as no line rather than a
  // placeholder.
  // Linked DraftHQ account first, then the commissioner's free-text owner name,
  // then an explicit "Unassigned". Imported leagues are mostly people who have
  // not signed up yet, so ownerName carries the real answer far more often than
  // ownerDisplayName does. Always returning a string matters: rendering nothing
  // for an unowned team looks identical to the feature being broken.
  const ownerNameFor = (leagueTeamId: string) => {
    const team = teams.find((entry) => entry.id === leagueTeamId);
    return team?.ownerDisplayName ?? team?.ownerName ?? "Unassigned";
  };

  const champion = lastCompletedSeason?.standings.find(
    (standing) => standing.leagueTeamId === lastCompletedSeason.championTeamId
  ) ?? null;
  const leagueStandings = lastCompletedSeason?.standings ?? [];
  const lastPlace = leagueStandings.length > 0
    ? leagueStandings.reduce((worst, standing) => standing.finalRank > worst.finalRank ? standing : worst, leagueStandings[0])
    : null;
  const previousLeagueYear = currentSeason?.year ? currentSeason.year - 1 : lastCompletedSeason?.year;

  // Primary actions inside a league wear the league's own accent. That now
  // comes from scope="league" on the action primitives rather than a locally
  // derived token pair — the primitive resolves the accessible foreground, so
  // a league that picks yellow still gets readable ink instead of white on
  // white.
  const teamSetupHref = `/leagues/${slug}/teams`;
  const roomHref = draft ? `/draft/lobby?draftId=${draft.id}&leagueSlug=${slug}` : null;
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
        <div className="relative flex items-center gap-5 p-5 lg:gap-6 lg:p-6">
          <div className="min-w-0 flex-1">
            <div className="mb-5 flex items-center gap-3 lg:hidden">
              <TeamMark src={workspace.league.logoUrl} name={workspace.league.name} className="h-14 w-14" accentColor={primary} />
              <div className="min-w-0">
                <p className="truncate text-base font-black text-white">{workspace.league.name}</p>
                <p className="mt-0.5 text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: primary }}>
                  {workspace.members.length} members
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: primary }}>
                {isOwnerView ? "Draft Night" : "League Command Center"}
              </p>
              {/* Draft state as a dot and a word, beside the eyebrow. It used
                  to be a tile in a row of four; this is the same information
                  at the size it deserves. Same for both roles. */}
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: draftTone === "live" ? "#5eead4" : "#94a3b8" }}
                />
                {draftLabel}
              </span>
            </div>
            {/* flex-wrap matters here: without it this row cannot break, so the
                buttons overflow the content column and spill over the team logo
                beside it. Putting the logo in flow fixed the container; this
                fixes the row inside it. */}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <h1 id="league-dashboard-title" className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                {currentSeason?.name ?? `${new Date().getFullYear()} Season`}
              </h1>
              {/* The primary action looks the same for everyone: one solid
                  accent button per surface. Create Season and Create Draft are
                  the only thing to do in their states, so they are primary.
                  Configure Draft stays secondary because once a draft exists,
                  Enter Draft Room is the primary action beside it. */}
              {workspace.canManage && (
                draft ? (
                  <LinkButton href={configureHref ?? teamSetupHref} variant="secondary" scope="league">
                    Configure Draft
                  </LinkButton>
                ) : !currentSeason ? (
                  <LinkButton
                    href={`/leagues/${slug}/seasons/new`}
                    variant="primary"
                    scope="league"
                  >
                    Create Season
                  </LinkButton>
                ) : (
                  <Button
                    onClick={onConfigureDraft}
                    scope="league"
                  >
                    Create Draft
                  </Button>
                )
              )}
              {isOwnerView ? (
                // Owners always get a way forward, but only into a room that is
                // actually open to them — see roomOpenToOwners in
                // ownerDashboard.ts. Otherwise this points at the team list, so
                // the hero is never actionless for an owner.
                <LinkButton
                  href={ownerView.primaryCta.target === "room" && roomHref ? roomHref : teamSetupHref}
                  variant="primary"
                  scope="league"
                >
                  {ownerView.primaryCta.label}
                </LinkButton>
              ) : (
                draftScheduled && roomHref && (
                  <LinkButton href={roomHref} variant="primary" scope="league">
                    Enter Draft Room
                  </LinkButton>
                )
              )}
              {/* Reset draft used to sit absolutely positioned in the top-right
                  corner, underneath the team logo — hard to see and easy to hit
                  by accident. It belongs with the other draft actions, and last
                  in the row since it is the destructive one. */}
              {/* Deliberately not <Button variant="danger">. That variant is a solid
                   fill, and a loud red block in the header beside Enter Draft Room
                   overstates an action nobody should be drawn toward. The system has no
                   quiet-destructive variant, so this keeps its outline until one exists. */}

              {workspace.canManage && draft && (
                <button
                  type="button"
                  onClick={onResetDraft}
                  className="inline-flex h-[var(--control-height-touch)] items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--color-danger)]/30 px-[var(--space-3)] text-[length:var(--font-size-control)] font-bold text-[color:var(--color-danger-border)] transition-colors hover:border-[color:var(--color-danger)]/50 hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)] sm:h-[var(--control-height-md)]"
                >
                  Reset Draft
                </button>
              )}
            </div>
            {/* Owners get a headline because they cannot act and need to know
                what is happening. Commissioners have the button and the tiles —
                the old summary narrated the state back at them ("create this
                season's draft so commissioners can configure the room"), which
                said nothing the Create Draft button beside it did not. */}

            {draft && (
              <div className="mt-5 max-w-5xl rounded-xl border border-slate-800/90 bg-slate-950/35 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <h2 className="text-base font-bold text-white">Draft Countdown</h2>
                    </div>
                    {workspace.canManage && !draft.scheduledAt && (
                      <LinkButton href={configureHref ?? teamSetupHref} variant="secondary" scope="league">
                        Schedule Draft
                      </LinkButton>
                    )}
                  </div>
                </div>
                {/* One band, not two columns. The old grid gave the clock 1fr
                    and the meta 0.75fr, so rounds and pick clock floated off at
                    the far right with a gap between — and boxed them inside a
                    panel that was already a box. They now sit next to the clock
                    as plain figures. */}
                <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                  {draft.scheduledAt && (
                    <Countdown
                      scheduledAt={draft.scheduledAt}
                      status={draft.status}
                      accentColor={primary}
                    />
                  )}
                  <div className="flex items-end gap-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Rounds</p>
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{draft.rounds}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Pick Clock</p>
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{formatPickClock(draft.pickSeconds)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Commissioners own a team too — the logo is about the viewer's
              franchise, not their role, so it is not gated on isOwnerView.

              It is a flex sibling rather than absolutely positioned. Out of
              flow it had nothing to push against, so as the card narrowed the
              action row and countdown ran underneath it. The previous guard was
              a pr-24 gutter on the title row, which only held at the one width
              it was measured at. */}
          {workspace.myTeam && (
            <div className="hidden w-28 shrink-0 justify-center sm:flex lg:w-40">
              {workspace.myTeam.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Preserve transparent uploaded logo treatment without an image wrapper.
                <img
                  src={workspace.myTeam.logoUrl}
                  alt={`${workspace.myTeam.name} logo`}
                  className="h-24 w-auto max-w-full object-contain drop-shadow-[0_16px_30px_rgba(0,0,0,0.42)] lg:h-36"
                />
              ) : (
                <span className="block text-xl font-black uppercase" style={{ color: primary }}>
                  {workspace.myTeam.name.slice(0, 2)}
                </span>
              )}
            </div>
          )}
        </div>

        {teamsError && (
          <p className="relative mx-5 mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 lg:mx-6">
            Team snapshot unavailable: {teamsError}
          </p>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.38fr)]">
        {/*
          <SectionPanel title="Draft Countdown">
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
                  <LinkButton href={configureHref ?? teamSetupHref} variant="secondary" scope="league">
                    Schedule Draft
                  </LinkButton>
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

        <SectionPanel title={lastCompletedSeason ? `${lastCompletedSeason.year} League Standings` : "League Standings"}>
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
          <SectionPanel title={previousLeagueYear ? `${previousLeagueYear} Champion` : "Champion"}>
            {champion && lastCompletedSeason ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <TeamMark src={champion.teamLogoUrl} name={champion.teamName} className="h-36 w-36" accentColor={primary} />
                <p className="mt-4 text-xl font-black text-white">{champion.teamName}</p>
                <p className="mt-1 text-sm font-semibold text-slate-300">{ownerNameFor(champion.leagueTeamId)}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {champion.wins}-{champion.losses}{champion.ties ? `-${champion.ties}` : ""}
                </p>
              </div>
            ) : (
              <EmptyState title="No champion yet" detail="The champion spotlight will unlock after a completed season is connected." />
            )}
          </SectionPanel>

          <SectionPanel title={previousLeagueYear ? `${previousLeagueYear} Loser` : "Loser"}>
            {lastPlace && champion && lastPlace.leagueTeamId !== champion.leagueTeamId ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <TeamMark src={lastPlace.teamLogoUrl} name={lastPlace.teamName} className="h-36 w-36" accentColor={primary} />
                <p className="mt-4 text-xl font-black text-white">{lastPlace.teamName}</p>
                <p className="mt-1 text-sm font-semibold text-slate-300">{ownerNameFor(lastPlace.leagueTeamId)}</p>
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

    </div>
  );
}
