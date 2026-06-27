"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PickModal from "@/components/PickModal";
import DraftBoard from "@/components/DraftBoard";
import DraftLobby from "@/components/DraftLobby";
import DraftChat from "@/components/DraftChat";
import DraftTicker from "@/components/DraftTicker";
import { buildRankMap, getRankings } from "@/lib/rankingsApi";
import type { EspnRanking } from "@/lib/rankingsApi";
import {
  commissionerEditPick,
  commissionerMakePick,
  expireCurrentPick,
  extendClock,
  getByeWeeks,
  makePick,
  pauseDraft,
  resetPickTimer,
  resumeDraft,
  startDraft,
  undoPick,
} from "@/lib/draftApi";
import { createDraftResultsCsv } from "@/lib/draftExport";
import {
  getPickNumberInRound,
  getRoundForPick,
  getTeamOnClock,
} from "@/lib/draftLogic";
import type { Draft, DraftParticipant, Pick as DraftPick, Player, RosterPosition, Team } from "@/types/draft";
import {
  getParticipantAccessState,
  getParticipantForUser,
} from "@/lib/participantLogic";
import { useRealtimeDraftRoom } from "@/hooks/useRealtimeDraftRoom";
import { formatLastSyncedAt } from "@/lib/draftRecovery";
import { getDraftClockSeconds, formatDraftClock } from "@/lib/draftTimer";
import { generateSnakeDraftOrder } from "@/lib/draftOrder";
import { getLeagueBranding, type LeagueBranding } from "@/lib/leagueApi";
import { useLeagueTheme } from "@/context/LeagueThemeContext";

function isPlayerEligible(player: Player, rosterPositions: RosterPosition[] | null): boolean {
  if (!rosterPositions || rosterPositions.length === 0) return true;
  const enabled = new Set(rosterPositions.filter((r) => r.enabled).map((r) => r.id));
  if (enabled.size === 0) return true;
  const pos = player.position;
  if (pos === "QB") return enabled.has("QB");
  if (pos === "RB") return enabled.has("RB") || enabled.has("FLEX");
  if (pos === "WR") return enabled.has("WR") || enabled.has("FLEX");
  if (pos === "TE") return enabled.has("TE") || enabled.has("FLEX");
  if (pos === "K") return enabled.has("K");
  if (pos === "DST") return enabled.has("DST");
  return true;
}

interface DraftRoomProps {
  draftId: string | null;
  leagueSlug?: string | null;
}

export default function DraftRoom({ draftId, leagueSlug }: DraftRoomProps) {
  const router = useRouter();
  const { setAccentColor, setBgColor } = useLeagueTheme();
  const {
    snapshot,
    status,
    error,
    refresh,
    lastSyncedAt,
    isRefreshing,
    onlineUserIds,
    applyDraftUpdate,
  } = useRealtimeDraftRoom(draftId);
  const [showPickModal, setShowPickModal] = useState(false);
  const [isMakingPick, setIsMakingPick] = useState(false);
  const [pickingPlayerId, setPickingPlayerId] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isControllingDraft, setIsControllingDraft] = useState(false);
  const [actionError, setActionError] = useState("");
  const [isExpiringPick, setIsExpiringPick] = useState(false);
  const [leagueBranding, setLeagueBranding] = useState<LeagueBranding | null>(null);
  const [byeWeeks, setByeWeeks] = useState<Map<string, number>>(new Map());
  const [showChat, setShowChat] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [boardView, setBoardView] = useState<"draft" | "players" | "roster" | "rounds">("draft");
  const [compactHeader, setCompactHeader] = useState(false);
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [showCommishMenu, setShowCommishMenu] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [showSettings, setShowSettings] = useState(false);
  // persisted display settings
  const [showCommishControls, setShowCommishControls] = useState(true);
  const [showPickReveal, setShowPickReveal] = useState(true);
  const [announcePickEnabled, setAnnouncePickEnabled] = useState(true);
  const [tickerMode, setTickerMode] = useState<"ticker" | "nav">("ticker");
  // card context menu
  const [cardMenu, setCardMenu] = useState<{ playerId: string; x: number; y: number } | null>(null);
  // queue & staged player (session-local)
  const [queue, setQueue] = useState<string[]>([]);
  const [stagedPlayerId, setStagedPlayerId] = useState<string | null>(null);
  // ESPN rankings
  const [espnRankings, setEspnRankings] = useState<EspnRanking[]>([]);
  // pick reveal modal
  const [revealPick, setRevealPick] = useState<DraftPick | null>(null);
  const revealInitRef = useRef(false);
  const lastRevealedPickNumRef = useRef(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerExpiredFiredRef = useRef(false);

  useEffect(() => {
    if (!draftId) {
      router.replace("/create");
    }
  }, [draftId, router]);

  useEffect(() => {
    if (leagueSlug) {
      void getLeagueBranding(leagueSlug).then((b) => {
        setLeagueBranding(b);
        if (b?.primaryColor) setAccentColor(b.primaryColor);
        if (b?.secondaryColor) setBgColor(b.secondaryColor);
      });
    }
  }, [leagueSlug, setAccentColor, setBgColor]);

  // Load bye weeks + ESPN rankings for the current NFL season year
  useEffect(() => {
    if (!snapshot) return;
    const scheduledAt = snapshot.draft.scheduledAt;
    const d = scheduledAt ? new Date(scheduledAt) : new Date();
    // NFL season: Sept onward = current year, Jan–Aug = previous year's season
    const seasonYear = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
    void getByeWeeks(seasonYear).then(setByeWeeks).catch(() => {});
    void getRankings(snapshot.draft.scoringType, seasonYear)
      .then(setEspnRankings)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.draft.id]);

  async function handleMakePick(playerId: string) {
    if (!draftId || !snapshot) {
      return;
    }

    if (status !== "connected") {
      setActionError(
        "Drafting is disabled until the room reconnects and refreshes."
      );
      return;
    }

    setActionError("");
    setIsMakingPick(true);
    setPickingPlayerId(playerId);

    const teamOnClockId = getTeamOnClock(
      snapshot.teams,
      snapshot.draft.currentPick,
      snapshot.draft.rounds
    )?.id;
    const isOwnerOnClock =
      accessState.kind === "assigned" &&
      accessState.teamId === teamOnClockId;

    try {
      if (!isOwnerOnClock) {
        // Commissioner picking on behalf of any team
        await commissionerMakePick(
          draftId,
          playerId,
          snapshot.draft.currentPick
        );
      } else {
        await makePick(draftId, playerId, snapshot.draft.currentPick);
      }
      await refresh();
      setShowPickModal(false);
    } catch (pickError) {
      setActionError(
        pickError instanceof Error ? pickError.message : "Unable to make pick."
      );
    } finally {
      setIsMakingPick(false);
      setPickingPlayerId(null);
    }
  }

  async function handleUndoPick() {
    if (!draftId) {
      return;
    }

    setActionError("");
    setIsUndoing(true);

    try {
      await undoPick(draftId);
      await refresh();
    } catch (undoError) {
      setActionError(
        undoError instanceof Error ? undoError.message : "Unable to undo pick."
      );
    } finally {
      setIsUndoing(false);
    }
  }


  async function handleDraftControl(action: () => Promise<Draft>) {
    setActionError("");
    setIsControllingDraft(true);

    try {
      const updatedDraft = await action();
      applyDraftUpdate(updatedDraft);
      await refresh();
    } catch (controlError) {
      setActionError(
        controlError instanceof Error
          ? controlError.message
          : (controlError as { message?: string })?.message ?? "Unable to update the draft."
      );
    } finally {
      setIsControllingDraft(false);
    }
  }

  const handleTimerExpired = useCallback(() => {
    if (!draftId || !snapshot || isExpiringPick) return;
    if (status !== "connected") return;
    if (snapshot.currentUserId !== snapshot.draft.commissionerUserId) return;

    const expectedPick = snapshot.draft.currentPick;
    setIsExpiringPick(true);

    void expireCurrentPick(draftId, expectedPick)
      .then((updatedDraft) => {
        applyDraftUpdate(updatedDraft);
        return refresh();
      })
      .catch((err: unknown) => {
        setActionError(
          err instanceof Error ? err.message : "Unable to expire pick."
        );
      })
      .finally(() => {
        setIsExpiringPick(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, snapshot?.draft.currentPick, snapshot?.currentUserId, snapshot?.draft.commissionerUserId, isExpiringPick, status]);

  function handleSkipPick() {
    setShowCommishMenu(false);
    handleTimerExpired();
  }

  async function handleExtendClock() {
    if (!draftId || !snapshot) return;
    try {
      const updatedDraft = await extendClock(draftId, snapshot.draft.currentPick);
      applyDraftUpdate(updatedDraft);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to extend clock."
      );
    }
  }

  useEffect(() => {
    timerExpiredFiredRef.current = false;
  }, [snapshot?.draft.currentPick]);

  // Detect newly confirmed picks and show the reveal modal
  useEffect(() => {
    if (!snapshot) return;
    if (!revealInitRef.current) {
      revealInitRef.current = true;
      // baseline: don't reveal picks that were made before we loaded
      lastRevealedPickNumRef.current = snapshot.draft.currentPick - 1;
      return;
    }
    const newest = [...snapshot.picks].sort((a, b) => b.overallPickNumber - a.overallPickNumber)[0];
    if (newest && newest.overallPickNumber > lastRevealedPickNumRef.current) {
      lastRevealedPickNumRef.current = newest.overallPickNumber;
      if (showPickReveal) setRevealPick(newest);
    }
  }, [snapshot?.picks.length, showPickReveal]);

  // TTS "The pick is in" when user stages a player
  const prevStagedRef = useRef<string | null>(null);
  useEffect(() => {
    if (stagedPlayerId && stagedPlayerId !== prevStagedRef.current) {
      prevStagedRef.current = stagedPlayerId;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const utt = new SpeechSynthesisUtterance("The pick is in");
        utt.rate = 0.85; utt.pitch = 0.95;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utt);
      }
    }
    if (!stagedPlayerId) prevStagedRef.current = null;
  }, [stagedPlayerId]);

  // TTS announcer after pick reveal appears
  useEffect(() => {
    if (!revealPick || !snapshot || !announcePickEnabled) return;
    const team = snapshot.teams.find((t) => t.id === revealPick.teamId);
    const allSlots = generateSnakeDraftOrder(snapshot.teams, snapshot.draft.rounds);
    const nextSlot = allSlots
      .filter((s) => s.overallPickNumber > revealPick.overallPickNumber)
      .sort((a, b) => a.overallPickNumber - b.overallPickNumber)[0];
    const nextTeam = nextSlot ? snapshot.teams.find((t) => t.id === nextSlot.teamId) : null;
    const nextClause = nextTeam ? `, ${nextTeam.name} is now on the clock` : "";
    const text = `With pick ${revealPick.overallPickNumber}, ${team?.name ?? "a team"} selects ${revealPick.playerName}${nextClause}`;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.85; utt.pitch = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealPick?.overallPickNumber, announcePickEnabled]);

  useEffect(() => {
    if (!snapshot) return;
    const tick = () => {
      const s = getDraftClockSeconds(snapshot.draft, Date.now(), snapshot.serverTimeOffsetMs);
      setTimerSeconds(s);
      if (s === 0 && snapshot.draft.status === "active" && snapshot.draft.pickDeadlineAt &&
          snapshot.draft.timerBehavior !== "nothing" && !timerExpiredFiredRef.current) {
        timerExpiredFiredRef.current = true;
        handleTimerExpired();
      }
    };
    tick();
    if (snapshot.draft.status !== "active") return;
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.draft, snapshot?.serverTimeOffsetMs, handleTimerExpired]);

  if (error && !snapshot) {
    return <main className="p-8 text-red-500">{error}</main>;
  }

  if (!snapshot) {
    return <main className="p-8">Connecting to draft room...</main>;
  }

  const teamNames = snapshot.teams.map((team) => team.name);
  const currentParticipant = getParticipantForUser(
    snapshot.participants,
    snapshot.currentUserId
  );
  const accessState = getParticipantAccessState(currentParticipant);
  const teamOnClock = getTeamOnClock(
    snapshot.teams,
    snapshot.draft.currentPick,
    snapshot.draft.rounds
  );
  const draftAcceptsPicks = snapshot.draft.status === "active";
  const isCommissioner =
    snapshot.currentUserId === snapshot.draft.commissionerUserId;
  const canMakePick =
    status === "connected" &&
    draftAcceptsPicks &&
    (
      (accessState.kind === "assigned" && accessState.teamId === teamOnClock?.id) ||
      isCommissioner
    );
  const canUndoPick = currentParticipant?.role === "commissioner";
  const assignedTeamCount = new Set(
    snapshot.participants.flatMap((participant) =>
      participant.teamId &&
      (participant.role === "commissioner" || participant.role === "owner")
        ? [participant.teamId]
        : []
    )
  ).size;
  const allTeamsAssigned = assignedTeamCount === snapshot.draft.teamCount;
  const currentParticipantId = currentParticipant?.id ?? null;

  // Show lobby before the draft starts
  if (snapshot.draft.status === "setup") {
    return (
      <>
        {actionError && (
          <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-800 bg-red-950 px-5 py-3 text-sm text-red-300 shadow-xl">
            {actionError}
          </div>
        )}
        <DraftLobby
          draft={snapshot.draft}
          participants={snapshot.participants}
          teams={snapshot.teams}
          onlineUserIds={onlineUserIds}
          currentUserId={snapshot.currentUserId}
          leagueSlug={leagueSlug ?? undefined}
          leagueLogoUrl={leagueBranding?.logoUrl ?? undefined}
          leagueName={leagueBranding?.name ?? (leagueSlug ? leagueSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : undefined)}
          isCommissioner={isCommissioner}
          isStarting={isControllingDraft}
          onStart={() =>
            void handleDraftControl(() => startDraft(draftId as string))
          }
        />
        <DraftChat
          draftId={draftId as string}
          participantId={currentParticipantId}
          isCommissioner={isCommissioner}
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          onUnreadChange={setChatUnread}
          participants={snapshot.participants}
          onlineUserIds={onlineUserIds}
        />
      </>
    );
  }

  const draftedPlayerIds = new Set(
    snapshot.picks.map((pick) => pick.playerId)
  );
  const availablePlayers = snapshot.players.filter(
    (player) => !draftedPlayerIds.has(player.id) && isPlayerEligible(player, snapshot.draft.rosterPositions)
  );

  // Merge ESPN rankings into player rank field (overrides static rank when available)
  const espnRankMap = buildRankMap(snapshot.players, espnRankings);
  const rankedAvailablePlayers = availablePlayers.map((p) => ({
    ...p,
    rank: espnRankMap.get(p.id) ?? p.rank,
  }));
  const currentRound = teamOnClock
    ? getRoundForPick(snapshot.draft.currentPick, snapshot.draft.teamCount)
    : null;
  const currentPickInRound = teamOnClock
    ? getPickNumberInRound(
        snapshot.draft.currentPick,
        snapshot.draft.teamCount
      )
    : null;


  const primaryColor = leagueBranding?.primaryColor ?? null;
  const secondaryColor = leagueBranding?.secondaryColor ?? null;
  const leagueLogoUrl = leagueBranding?.logoUrl ?? null;

  // Next-up queue: next 10 teams in pick order after the current pick
  const allSlots = generateSnakeDraftOrder(snapshot.teams, snapshot.draft.rounds);
  const nextUpSlots = allSlots
    .filter((s) => s.overallPickNumber > snapshot.draft.currentPick)
    .sort((a, b) => a.overallPickNumber - b.overallPickNumber)
    .slice(0, 12);

  // Staged player lookup
  const stagedPlayer = stagedPlayerId
    ? snapshot.players.find((p) => p.id === stagedPlayerId) ?? null
    : null;

  // Timer display
  const timerUrgent = timerSeconds <= 10 && snapshot.draft.status === "active" && Boolean(snapshot.draft.pickDeadlineAt);
  const timerWarn = timerSeconds <= 30 && !timerUrgent && snapshot.draft.status === "active" && Boolean(snapshot.draft.pickDeadlineAt);
  const timerColor = timerUrgent ? "text-red-400" : timerWarn ? "text-amber-400" : "text-white";
  const timerPercent = snapshot.draft.pickSeconds > 0
    ? Math.min(100, Math.round((timerSeconds / snapshot.draft.pickSeconds) * 100))
    : 0;
  const timerBarColor = timerUrgent ? "bg-red-500" : timerWarn ? "bg-amber-400" : "bg-teal-400";

  const headerGradient = primaryColor
    ? { background: `linear-gradient(135deg, ${primaryColor}18 0%, ${secondaryColor ?? primaryColor}08 100%)` }
    : { background: "linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(15,23,42,0) 100%)" };

  const accentStyle = primaryColor ? { backgroundColor: primaryColor, color: secondaryColor ?? "#0f172a" } : {};

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">

      {/* ── ROW 1: Timer · On Clock · Next Up ── */}
      {compactHeader ? (
        /* Compact bar — large readable text, single row */
        <div className="shrink-0 flex items-center gap-4 border-b border-white/5 bg-slate-950 px-4" style={{ height: "56px" }}>
          {/* Commissioner controls */}
          {isCommissioner && showCommishControls && snapshot.draft.status !== "complete" && (
            <div className="flex items-center gap-1.5">
              {snapshot.draft.status === "active" ? (
                <button type="button" title="Pause" disabled={isControllingDraft}
                  className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
                  onClick={() => void handleDraftControl(() => pauseDraft(draftId as string))}>
                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5"><rect x="1.5" y="1" width="3" height="10" rx="0.75"/><rect x="7.5" y="1" width="3" height="10" rx="0.75"/></svg>
                </button>
              ) : (
                <button type="button" title="Resume" disabled={isControllingDraft}
                  className="flex h-8 w-8 items-center justify-center rounded bg-green-700/60 text-green-300 hover:bg-green-700 disabled:opacity-40"
                  onClick={() => void handleDraftControl(() => resumeDraft(draftId as string))}>
                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5"><polygon points="2,1 11,6 2,11"/></svg>
                </button>
              )}
              <button type="button" title="Reset timer" disabled={isControllingDraft || snapshot.draft.status !== "active" || snapshot.draft.pickSeconds === 0}
                className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                onClick={() => void handleDraftControl(() => resetPickTimer(draftId as string))}>
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5"><path d="M6 2a4 4 0 1 0 3.46 2h-1.2A2.8 2.8 0 1 1 6 3.2V2.5L8 1 6 0v2z"/></svg>
              </button>
            </div>
          )}

          {/* Timer */}
          <span className={`font-mono text-4xl font-black tabular-nums leading-none ${timerColor}`}>
            {snapshot.draft.pickSeconds > 0 ? formatDraftClock(timerSeconds) : "--:--"}
          </span>

          <span className="h-8 w-px bg-white/8" />

          {/* Round */}
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Round</span>
            <span className="text-5xl font-black leading-none text-white">{currentRound ?? "1"}</span>
          </div>

          {/* Pick */}
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Pick</span>
            <span className="text-5xl font-black leading-none text-white">{currentPickInRound ?? "—"}</span>
          </div>

          {teamOnClock && snapshot.draft.status !== "complete" && (
            <>
              <span className="h-8 w-px bg-white/8" />
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">On the clock</span>
                <span className="text-3xl font-black uppercase leading-none" style={canMakePick && primaryColor ? { color: primaryColor } : { color: "#67e8f9" }}>
                  {teamOnClock.name}
                </span>
              </div>
            </>
          )}
        </div>
      ) : (
      <div className="shrink-0 border-b border-white/5" style={headerGradient}>
        <div className="flex items-stretch divide-x divide-white/5 overflow-x-auto">

          {/* Timer block */}
          <div className="flex shrink-0 items-center gap-4 px-4 py-3">
            {/* Commissioner clock controls */}
            {isCommissioner && showCommishControls && snapshot.draft.status !== "complete" && (
              <div className="flex flex-col gap-1.5">
                {snapshot.draft.status === "active" ? (
                  <button type="button" title="Pause draft" disabled={isControllingDraft}
                    className="flex h-7 w-7 items-center justify-center rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 transition-colors"
                    onClick={() => void handleDraftControl(() => pauseDraft(draftId as string))}>
                    <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5">
                      <rect x="1.5" y="1" width="3" height="10" rx="0.75"/>
                      <rect x="7.5" y="1" width="3" height="10" rx="0.75"/>
                    </svg>
                  </button>
                ) : (
                  <button type="button" title="Resume draft" disabled={isControllingDraft}
                    className="flex h-7 w-7 items-center justify-center rounded bg-green-700/60 text-green-300 hover:bg-green-700 hover:text-white disabled:opacity-40 transition-colors"
                    onClick={() => void handleDraftControl(() => resumeDraft(draftId as string))}>
                    <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5">
                      <polygon points="2,1 11,6 2,11"/>
                    </svg>
                  </button>
                )}
                <button type="button" title={`Add ${snapshot.draft.clockExtensionSeconds}s`}
                  disabled={isControllingDraft || snapshot.draft.status !== "active" || snapshot.draft.pickSeconds === 0 || snapshot.draft.clockExtensionsUsed >= snapshot.draft.maxClockExtensions}
                  className="flex h-7 w-7 items-center justify-center rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
                  onClick={() => void handleExtendClock()}>
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-3.5 w-3.5">
                    <path d="M2 6h8M6 2v8"/>
                  </svg>
                </button>
                <button type="button" title="Reset timer" disabled={isControllingDraft || snapshot.draft.status !== "active" || snapshot.draft.pickSeconds === 0}
                  className="flex h-7 w-7 items-center justify-center rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
                  onClick={() => void handleDraftControl(() => resetPickTimer(draftId as string))}>
                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M6 2a4 4 0 1 0 3.46 2h-1.2A2.8 2.8 0 1 1 6 3.2V2.5L8 1 6 0v2z"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Clock display */}
            <div className="flex flex-col items-center gap-1.5">
              <span className={`font-mono text-6xl font-black tabular-nums leading-none ${timerColor}`}>
                {snapshot.draft.pickSeconds > 0 ? formatDraftClock(timerSeconds) : "--:--"}
              </span>
              {snapshot.draft.pickSeconds > 0 && (
                <div className="h-1.5 w-28 rounded-full bg-white/10">
                  <div className={`h-full rounded-full transition-all duration-200 ${timerBarColor}`} style={{ width: `${timerPercent}%` }} />
                </div>
              )}
            </div>
          </div>

          {/* Round / Pick */}
          <div className="flex shrink-0 items-center gap-5 px-5 py-3">
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Round</div>
              <div className="text-5xl font-black leading-none">{currentRound ?? (snapshot.draft.status === "complete" ? "—" : "1")}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pick</div>
              <div className="text-5xl font-black leading-none">{currentPickInRound ?? "—"}</div>
            </div>
          </div>

          {/* Team on clock + Next Up stacked */}
          {teamOnClock && snapshot.draft.status !== "complete" && (
            <div className="flex shrink-0 items-center gap-4 px-5 py-2">
              {/* Logo / avatar always shown */}
              {teamOnClock.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={teamOnClock.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-white/10" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xl font-black text-slate-300">
                  {teamOnClock.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col justify-center">
                {stagedPlayer && canMakePick ? (
                  /* "THE PICK IS IN..." mode */
                  <>
                    <div className="text-5xl font-black italic uppercase leading-none tracking-wide text-white animate-pulse">
                      THE PICK IS IN...
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-400">
                      {stagedPlayer.fullName}
                      <span className="ml-2 text-slate-600">{stagedPlayer.position}{stagedPlayer.nflTeam ? `/${stagedPlayer.nflTeam}` : ""}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none mb-0.5">
                      {canMakePick ? "Your pick" : "On the clock"}
                    </div>
                    <div className="text-5xl font-black uppercase leading-none tracking-wide" style={canMakePick && primaryColor ? { color: primaryColor } : { color: "#fff" }}>
                      {teamOnClock.name}
                    </div>
                  </>
                )}
                {nextUpSlots.length > 0 && (
                  <div className="flex items-center gap-4 mt-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <span className="shrink-0 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Next Up:</span>
                    {nextUpSlots.map((slot, i) => (
                      <span key={slot.overallPickNumber} className={`shrink-0 text-sm font-bold ${i === 0 ? "text-slate-200" : "text-slate-500"}`}>
                        {slot.teamName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {snapshot.draft.status === "complete" && (
            <div className="flex shrink-0 items-center px-5 py-3">
              <span className="text-3xl font-black text-green-400">Draft Complete</span>
            </div>
          )}

        </div>
      </div>
      )} {/* end compactHeader conditional */}


      {/* ── Alerts strip (connection issues / errors) ── */}
      {(status !== "connected" || error || actionError) && (
        <div className="shrink-0 border-b border-white/5">
          {status !== "connected" && (
            <div className="flex items-center gap-3 bg-yellow-950/60 px-4 py-2">
              <p className="flex-1 text-xs font-semibold text-yellow-300">{status === "connecting" ? "Reconnecting..." : "Connection interrupted — picks paused"} · {formatLastSyncedAt(lastSyncedAt)}</p>
              <button type="button" disabled={isRefreshing} className="text-xs text-yellow-400 hover:text-yellow-200 disabled:opacity-50 transition-colors" onClick={() => void refresh()}>
                {isRefreshing ? "..." : "Retry"}
              </button>
            </div>
          )}
          {(error || actionError) && (
            <p className="bg-red-950/60 px-4 py-2 text-xs font-semibold text-red-300">{actionError || error}</p>
          )}
        </div>
      )}


      {/* ── ROW 2: Board switcher toolbar ── */}
      {/* Close menus when clicking elsewhere */}
      {(showBoardMenu || showCommishMenu) && (
        <div className="fixed inset-0 z-30" onClick={() => { setShowBoardMenu(false); setShowCommishMenu(false); }} />
      )}
      <div className="relative z-40 shrink-0 grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-white/5 bg-slate-900/90 px-3 py-1.5">
        {/* ── Left: board dropdown + commish menu ── */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button type="button"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10 transition-colors"
              onClick={() => { setShowBoardMenu((v) => !v); setShowCommishMenu(false); }}>
              {boardView === "draft" ? "Draft Board" : boardView === "players" ? "Player Board" : boardView === "roster" ? "Roster Board" : "Round Summary"}
              <svg viewBox="0 0 10 6" fill="currentColor" className="h-2 w-2.5 text-slate-500"><path d="M0 0l5 6 5-6z"/></svg>
            </button>
            {showBoardMenu && (
              <div className="absolute top-full left-0 mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                {(["draft","players","roster","rounds"] as const).map((v) => {
                  const labels = { draft: "Draft Board", players: "Player Board", roster: "Roster Board", rounds: "Round Summary" };
                  return (
                    <button key={v} type="button"
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${boardView === v ? "bg-white/10 font-semibold text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                      onClick={() => { setBoardView(v); setShowBoardMenu(false); }}>
                      {labels[v]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isCommissioner && (
            <div className="relative">
              <button type="button"
                className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm font-bold text-slate-300 hover:bg-white/10 transition-colors"
                onClick={() => { setShowCommishMenu((v) => !v); setShowBoardMenu(false); }}>
                ···
              </button>
              {showCommishMenu && (
                <div className="absolute top-full left-0 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                  {canUndoPick && snapshot.picks.length > 0 && (
                    <button type="button" disabled={isUndoing}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-40 transition-colors"
                      onClick={() => { setShowCommishMenu(false); void handleUndoPick(); }}>
                      Undo previous pick <span className="text-slate-600">↩</span>
                    </button>
                  )}
                  {snapshot.draft.status === "active" && teamOnClock && (
                    <button type="button" disabled={isExpiringPick || status !== "connected"}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-40 transition-colors"
                      onClick={handleSkipPick}>
                      Skip pick <span className="text-slate-600">⏭</span>
                    </button>
                  )}
                  <div className="mx-3 my-1 border-t border-white/5" />
                  {snapshot.draft.status === "active" && (
                    <button type="button" disabled={isControllingDraft}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-40 transition-colors"
                      onClick={() => { setShowCommishMenu(false); void handleDraftControl(() => pauseDraft(draftId as string)); }}>
                      Take a Draft Break <span className="text-slate-600">⏸</span>
                    </button>
                  )}
                  {snapshot.draft.status === "paused" && (
                    <button type="button" disabled={isControllingDraft}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-green-400 hover:bg-white/5 hover:text-green-300 disabled:opacity-40 transition-colors"
                      onClick={() => { setShowCommishMenu(false); void handleDraftControl(() => resumeDraft(draftId as string)); }}>
                      Resume Draft <span className="text-slate-600">▶</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Center: search dropdown + Draft Player ── */}
        <div className="flex items-center justify-center gap-2">
          <div className="relative">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" style={{ left: "10px" }}>
              <circle cx="6.5" cy="6.5" r="4"/><path d="M11 11l3 3"/>
            </svg>
            <input
              type="text"
              placeholder={stagedPlayer ? `${stagedPlayer.fullName} ${stagedPlayer.position}/${stagedPlayer.nflTeam ?? "FA"}` : "Search players..."}
              value={playerSearch}
              className="w-52 rounded-lg border bg-white/5 py-1.5 pr-8 text-xs placeholder:text-slate-400 focus:outline-none focus:w-72 transition-all"
              style={{
                paddingLeft: "32px",
                borderColor: stagedPlayer && !playerSearch ? "#14b8a6" : "rgba(255,255,255,0.08)",
                color: stagedPlayer && !playerSearch ? "#5eead4" : "#e2e8f0",
              }}
              onChange={(e) => setPlayerSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setPlayerSearch(""); setStagedPlayerId(null); }
              }}
            />
            {(playerSearch || stagedPlayer) && (
              <button type="button" onClick={() => { setPlayerSearch(""); setStagedPlayerId(null); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
              </button>
            )}
            {/* Dropdown results */}
            {playerSearch.trim().length > 0 && (
              <div className="absolute top-full left-0 z-50 mt-1 w-80 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                {rankedAvailablePlayers
                  .filter((p) => p.fullName.toLowerCase().includes(playerSearch.toLowerCase()))
                  .slice(0, 8)
                  .map((p) => {
                    const posColor = ({ QB:"#38bdf8", RB:"#fbbf24", WR:"#fb923c", TE:"#a78bfa", K:"#4ade80", DST:"#f87171" } as Record<string,string>)[p.position] ?? "#94a3b8";
                    const nameParts = p.fullName.split(" ");
                    const last = nameParts.slice(1).join(" ") || nameParts[0];
                    const first = nameParts.length > 1 ? nameParts[0] : "";
                    return (
                      <button key={p.id} type="button"
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                        onClick={() => {
                          setStagedPlayerId(p.id);
                          setPlayerSearch("");
                        }}>
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black"
                          style={{ backgroundColor: `${posColor}25`, color: posColor }}
                        >{p.position}</span>
                        <span className="flex-1 text-sm font-semibold text-white">
                          {last}{first && <span className="text-slate-500">, {first}</span>}
                        </span>
                        <span className="shrink-0 text-xs font-bold text-slate-500">{p.nflTeam ?? "FA"}</span>
                      </button>
                    );
                  })}
                {rankedAvailablePlayers.filter((p) => p.fullName.toLowerCase().includes(playerSearch.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-xs text-slate-600">No players found</div>
                )}
              </div>
            )}
          </div>

          {canMakePick && snapshot.draft.status === "active" && (
            <button type="button"
              className="rounded-lg px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all hover:opacity-90"
              style={stagedPlayer
                ? { backgroundColor: "#14b8a6", color: "#0f172a", boxShadow: "0 0 14px #14b8a660" }
                : (accentStyle.backgroundColor ? { ...accentStyle, opacity: 0.65 } : { backgroundColor: "#14b8a6", color: "#0f172a", opacity: 0.65 })
              }
              onClick={() => {
                setActionError("");
                if (stagedPlayer) {
                  void handleMakePick(stagedPlayer.id);
                  setStagedPlayerId(null);
                } else {
                  setShowPickModal(true);
                }
              }}>
              {stagedPlayer ? "Draft Player" : "Pick Player"}
            </button>
          )}
        </div>

        {/* ── Right: connection dot · sound · fullscreen toggle · settings ── */}
        <div className="flex items-center justify-end gap-0.5">
          <div className={`h-2 w-2 rounded-full mr-2 ${status === "connected" ? "bg-green-400" : "bg-yellow-400 animate-pulse"}`} title={status} />

          {/* Sound — not yet implemented */}
          <button type="button" title="Sound effects (coming soon)" disabled
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 cursor-not-allowed">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M9.293 3.293a1 1 0 0 1 1.414 0L13 5.586V4a1 1 0 1 1 2 0v4a1 1 0 0 1-1 1H10a1 1 0 1 1 0-2h1.586L9.293 4.707a1 1 0 0 1 0-1.414z" style={{display:"none"}}/>
              <path d="M10 3L5.5 7H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2.5L10 17V3zm4.243 1.757a8 8 0 0 1 0 11.314l-1.415-1.414a6 6 0 0 0 0-8.486l1.415-1.414zm-2.829 2.829a4 4 0 0 1 0 5.656l-1.414-1.414a2 2 0 0 0 0-2.828l1.414-1.414z"/>
            </svg>
          </button>

          {/* Compact / fullscreen toggle */}
          <button type="button" title={compactHeader ? "Expand header" : "Compact header"}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${compactHeader ? "bg-white/10 text-slate-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            onClick={() => setCompactHeader((v) => !v)}>
            {compactHeader ? (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-5 w-5">
                <path d="M7 2H3a1 1 0 0 0-1 1v4M13 2h4a1 1 0 0 1 1 1v4M7 18H3a1 1 0 0 1-1-1v-4M13 18h4a1 1 0 0 0 1-1v-4"/>
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-5 w-5">
                <path d="M2 7V3a1 1 0 0 1 1-1h4M18 7V3a1 1 0 0 0-1-1h-4M2 13v4a1 1 0 0 0 1 1h4M18 13v4a1 1 0 0 1-1 1h-4"/>
              </svg>
            )}
          </button>

          {/* Settings — proper cog icon */}
          <button type="button" title="Settings"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${showSettings ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            onClick={() => setShowSettings((v) => !v)}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 0 1-2.287-.947zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Board area (fills remaining space) ── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {boardView === "draft" && (
          <DraftBoard
            teams={teamNames}
            rounds={snapshot.draft.rounds}
            picks={snapshot.picks}
            currentPickNumber={snapshot.draft.currentPick}
            draftStatus={snapshot.draft.status}
            canMakePick={canMakePick && !isMakingPick}
            canUndoPick={canUndoPick && !isUndoing}
            byeWeeks={byeWeeks.size > 0 ? byeWeeks : undefined}
            myTeamName={
              accessState.kind === "assigned"
                ? snapshot.teams.find((t) => t.id === accessState.teamId)?.name
                : undefined
            }
            onSlotClick={() => { setActionError(""); setShowPickModal(true); }}
            onUndoPick={handleUndoPick}
          />
        )}

        {boardView === "players" && (
          <PlayerListView
            players={rankedAvailablePlayers}
            search={playerSearch}
            onSearchChange={setPlayerSearch}
            posFilter={posFilter}
            onPosFilterChange={setPosFilter}
            canPick={canMakePick && !isMakingPick}
            pickingPlayerId={pickingPlayerId}
            queue={queue}
            stagedPlayerId={stagedPlayerId}
            onCardClick={(id, rect) => {
              const x = Math.min(rect.left, window.innerWidth - 192);
              const y = rect.bottom + 6;
              setCardMenu({ playerId: id, x, y });
            }}
          />
        )}

        {boardView === "roster" && (
          <RosterBoardView teams={snapshot.teams} picks={snapshot.picks} />
        )}

        {boardView === "rounds" && (
          <RoundSummaryView
            draftId={draftId as string}
            teams={snapshot.teams}
            picks={snapshot.picks}
            players={snapshot.players}
            currentPickNumber={snapshot.draft.currentPick}
            rounds={snapshot.draft.rounds}
            byeWeeks={byeWeeks}
            isCommissioner={isCommissioner}
            onUndoPick={handleUndoPick}
          />
        )}
      </div>

      {/* ── Mobile pick bar (hidden on desktop) ── */}
      {canMakePick && (
        <div className="shrink-0 border-t border-white/5 bg-slate-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <button type="button" className="w-full rounded-xl py-3 text-sm font-black uppercase tracking-wider text-slate-950 transition-opacity hover:opacity-90"
            style={accentStyle.backgroundColor ? accentStyle : { backgroundColor: "#14b8a6", color: "#0f172a" }}
            onClick={() => { setActionError(""); setShowPickModal(true); }}>
            Draft Player — {teamOnClock?.name}
          </button>
        </div>
      )}

      {/* ── Ticker / nav bar ── */}
      <DraftTicker
        draftName={snapshot.draft.name}
        leagueName={leagueBranding?.name ?? undefined}
        picks={snapshot.picks}
        teams={snapshot.teams}
        unread={chatUnread}
        isChatOpen={showChat}
        onChatToggle={() => setShowChat((v) => !v)}
        accentColor={primaryColor ?? undefined}
        mode={tickerMode}
        boardView={boardView}
        onBoardViewChange={setBoardView}
        posFilter={posFilter}
        onPosFilterChange={setPosFilter}
      />

      {showPickModal && (
        <PickModal
          title={`Draft Player — ${teamOnClock?.name ?? "Team"}`}
          players={availablePlayers}
          isSaving={isMakingPick}
          error={actionError}
          onClose={() => { if (!isMakingPick) { setShowPickModal(false); setActionError(""); } }}
          onSave={handleMakePick}
        />
      )}

      <DraftChat
        draftId={draftId as string}
        participantId={currentParticipantId}
        isCommissioner={isCommissioner}
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        onUnreadChange={setChatUnread}
        participants={snapshot.participants}
        onlineUserIds={onlineUserIds}
      />

      {/* ── Card context menu ── */}
      {cardMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCardMenu(null)} />
          <div
            className="fixed z-50 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl"
            style={{ top: cardMenu.y, left: cardMenu.x, width: 180 }}>
            <button type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              onClick={() => {
                setQueue((q) => q.includes(cardMenu.playerId) ? q : [...q, cardMenu.playerId]);
                setCardMenu(null);
              }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-4 w-4 shrink-0 text-slate-500">
                <path d="M3 4h10M3 8h10M3 12h6"/>
                <path d="M12 10v4M10 12h4" strokeWidth="1.5"/>
              </svg>
              Add to Queue
              {queue.includes(cardMenu.playerId) && (
                <span className="ml-auto text-[10px] font-black text-teal-400">✓</span>
              )}
            </button>
            <button type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors border-t border-white/5"
              onClick={() => {
                setStagedPlayerId((s) => s === cardMenu.playerId ? null : cardMenu.playerId);
                setCardMenu(null);
              }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-slate-500">
                <path d="M8 2l1.5 3 3.5.5-2.5 2.5.6 3.5L8 10l-3.1 1.5.6-3.5L3 5.5l3.5-.5z"/>
              </svg>
              Stage Player
              {stagedPlayerId === cardMenu.playerId && (
                <span className="ml-auto text-[10px] font-black text-amber-400">✓</span>
              )}
            </button>
            {canMakePick && !isMakingPick && (
              <button type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-black text-white hover:bg-teal-500/20 transition-colors border-t border-white/5"
                onClick={() => {
                  setActionError("");
                  void handleMakePick(cardMenu.playerId);
                  setCardMenu(null);
                }}>
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0 text-teal-400">
                  <path d="M3 8l4 4 6-7" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Draft Player
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Pick reveal modal ── */}
      {revealPick && (
        <PickRevealModal
          pick={revealPick}
          teams={snapshot.teams}
          draftName={snapshot.draft.name}
          leagueLogoUrl={leagueLogoUrl ?? undefined}
          canUndo={isCommissioner && snapshot.draft.status !== "complete"}
          onUndo={() => { void handleUndoPick(); setRevealPick(null); }}
          onClose={() => setRevealPick(null)}
        />
      )}

      {/* ── Settings popup ── */}
      {showSettings && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
          {/* popup card — positioned below the toolbar row */}
          <div className="fixed right-2 top-24 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl"
            style={{ width: "min(300px, calc(100vw - 16px))", maxHeight: "calc(100dvh - 120px)" }}>

            {/* header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Settings</span>
              <button type="button" aria-label="Close"
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-white/10 hover:text-white transition-colors"
                onClick={() => setShowSettings(false)}>
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-3 w-3"><path d="M1 1l10 10M11 1L1 11"/></svg>
              </button>
            </div>

            <div className="overflow-y-auto">

              {/* DISPLAY */}
              <div className="px-4 pb-0.5 pt-3">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">Display</span>
              </div>

              {isCommissioner && (
                <SettingsToggleRow
                  label="Commish Mode"
                  description="Show clock controls in header"
                  value={showCommishControls}
                  onChange={setShowCommishControls}
                />
              )}

              <SettingsToggleRow
                label="Pick Reveal"
                description="Show selection card after each pick"
                value={showPickReveal}
                onChange={setShowPickReveal}
              />

              <SettingsToggleRow
                label="Pos Menu (bottom bar)"
                description="Swap ticker for board nav buttons"
                value={tickerMode === "nav"}
                onChange={(v) => setTickerMode(v ? "nav" : "ticker")}
              />

              {/* AUDIO */}
              <div className="px-4 pb-0.5 pt-4">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">Audio</span>
              </div>

              <SettingsToggleRow
                label="Pick Announcer"
                description="Read each pick aloud after it's made"
                value={announcePickEnabled}
                onChange={setAnnouncePickEnabled}
              />

              <div className="flex items-start justify-between px-4 py-2.5">
                <div className="min-w-0 pr-4">
                  <p className="text-sm font-semibold text-slate-500">Clock Sound</p>
                  <p className="text-[11px] text-slate-700">Timer tick &amp; beep</p>
                </div>
                <span className="shrink-0 rounded-full border border-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700">Soon</span>
              </div>

              {/* LEAGUE */}
              <div className="px-4 pb-0.5 pt-4">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">League</span>
              </div>

              {leagueSlug && (
                <a href={`/teams?draftId=${draftId}&tab=settings&fromDraft=1${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                  onClick={() => setShowSettings(false)}>
                  Draft Settings
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 text-slate-600"><path d="M2 6h8M6 2l4 4-4 4"/></svg>
                </a>
              )}

              <button type="button"
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => {
                  const csv = createDraftResultsCsv(snapshot.teams, snapshot.picks);
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${snapshot.draft.name.replace(/\s+/g, "-")}-results.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                Draft Reports
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 text-slate-600"><path d="M6 1v7M3 6l3 3 3-3M2 11h8"/></svg>
              </button>

              {/* back / exit */}
              <div className="border-t border-white/5 mt-1">
                {leagueSlug ? (
                  <a href={`/leagues/${leagueSlug}`}
                    className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white">
                    Back to League
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 text-slate-600"><path d="M8 2H4a2 2 0 00-2 2v4a2 2 0 002 2h4M7 4l2 2-2 2M9 6H5"/></svg>
                  </a>
                ) : (
                  <a href="/dashboard"
                    className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white">
                    Leave Draft
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 text-slate-600"><path d="M8 2H4a2 2 0 00-2 2v4a2 2 0 002 2h4M7 4l2 2-2 2M9 6H5"/></svg>
                  </a>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function PlayerSilhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full opacity-20" aria-hidden="true">
      {/* Head */}
      <ellipse cx="24" cy="16" rx="10" ry="11" fill={color}/>
      {/* Shoulders / body */}
      <path d="M4 72 C4 48 10 40 24 38 C38 40 44 48 44 72Z" fill={color}/>
    </svg>
  );
}

function SettingsToggleRow({
  label, description, value, onChange,
}: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button"
      className="flex w-full items-start justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
      onClick={() => onChange(!value)}>
      <div className="min-w-0 pr-4">
        <p className="text-sm font-semibold text-slate-200">{label}</p>
        <p className="text-[11px] text-slate-600">{description}</p>
      </div>
      {/* Toggle pill */}
      <div className={`relative mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${value ? "bg-teal-500" : "bg-slate-700"}`}>
        <span className={`absolute h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
      </div>
    </button>
  );
}

// ── Inline board views ──────────────────────────────────────────────────────

const POSITION_COLORS: Record<string, string> = {
  QB: "#67E8F9", RB: "#FCD34D", WR: "#F97316",
  TE: "#A78BFA", K: "#4ADE80", DST: "#F87171",
};

// Card colors — bright solid backgrounds with dark text (FanDraft-style)
// All values are hex so Tailwind purging can't strip them
const POSITION_CARD: Record<string, { bg: string; border: string; text: string; dark: string }> = {
  QB:  { bg: "#38bdf8", border: "#7dd3fc", text: "#0c4a6e", dark: "#0c4a6e" },
  RB:  { bg: "#fbbf24", border: "#fcd34d", text: "#78350f", dark: "#78350f" },
  WR:  { bg: "#fb923c", border: "#fdba74", text: "#7c2d12", dark: "#7c2d12" },
  TE:  { bg: "#a78bfa", border: "#c4b5fd", text: "#3b0764", dark: "#3b0764" },
  K:   { bg: "#4ade80", border: "#86efac", text: "#14532d", dark: "#14532d" },
  DST: { bg: "#f87171", border: "#fca5a5", text: "#7f1d1d", dark: "#7f1d1d" },
};

// Position sort priority (standard draft value order)
const POS_ORDER: Record<string, number> = { RB: 0, WR: 1, QB: 2, TE: 3, K: 4, DST: 5 };

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(" ");
  if (parts.length === 1) return { first: "", last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function PlayerListView({
  players, search, onSearchChange, posFilter, onPosFilterChange,
  canPick, pickingPlayerId, queue, stagedPlayerId, onCardClick,
}: {
  players: Player[];
  search: string;
  onSearchChange: (s: string) => void;
  posFilter: string;
  onPosFilterChange: (pos: string) => void;
  canPick: boolean;
  pickingPlayerId: string | null;
  queue: string[];
  stagedPlayerId: string | null;
  onCardClick: (id: string, rect: DOMRect) => void;
}) {
  const [sort, setSort] = useState<"rank" | "name" | "position">("rank");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const hasRankings = players.some((p) => p.rank != null);

  const positions = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];
  const q = search.trim().toLowerCase();

  const visible = players
    .filter((p) => {
      if (posFilter !== "ALL" && p.position !== posFilter) return false;
      if (!q) return true;
      return [p.fullName, p.position, p.nflTeam ?? ""].join(" ").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === "rank") {
        if (a.rank != null && b.rank != null) return a.rank - b.rank;
        if (a.rank != null) return -1;
        if (b.rank != null) return 1;
        return (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9);
      }
      if (sort === "name") return a.fullName.localeCompare(b.fullName);
      return (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9);
    });

  return (
    <div className="flex h-full flex-col">
      {/* Filter / sort bar */}
      <div className="shrink-0 flex items-center gap-2 border-b border-white/5 bg-slate-950/80 px-3 py-2">
        {/* Position pills */}
        <div className="flex gap-1 overflow-x-auto">
          {positions.map((pos) => {
            const card = POSITION_CARD[pos];
            return (
              <button key={pos} type="button"
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                  posFilter === pos
                    ? "border-white/30 bg-white text-slate-950"
                    : `border-white/5 bg-white/5 hover:bg-white/10 hover:text-white ${card ? "" : "text-slate-500"}`
                }`}
                style={posFilter !== pos && card ? { color: card.text } : {}}
                onClick={() => onPosFilterChange(pos)}>
                {pos === "ALL" ? "All" : pos}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Sort dropdown */}
        <div className="relative">
          <button type="button"
            className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-400 hover:bg-white/10 transition-colors"
            onClick={() => setShowSortMenu((v) => !v)}>
            {sort === "rank" ? "By Rank" : sort === "name" ? "By Name" : "By Position"}
            <svg viewBox="0 0 8 5" fill="currentColor" className="h-2 w-2"><path d="M0 0l4 5 4-5z"/></svg>
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full z-40 mt-1 w-36 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-xl">
                {(["rank", "name", "position"] as const).map((s) => (
                  <button key={s} type="button"
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${sort === s ? "bg-white/10 font-semibold text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                    onClick={() => { setSort(s); setShowSortMenu(false); }}>
                    {s === "rank" ? "By Rank" : s === "name" ? "By Name" : "By Position"}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <span className="shrink-0 text-[10px] text-slate-700">{visible.length} available</span>
      </div>

      {/* Rankings notice */}
      {!hasRankings && (
        <div className="shrink-0 border-b border-white/5 bg-amber-950/20 px-4 py-1.5">
          <p className="text-[11px] text-amber-600">Rankings not imported — showing players by position group. Import rankings via the league settings to enable rank ordering.</p>
        </div>
      )}

      {/* Card grid — edge-to-edge, no gaps, FanDraft style */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-600">No players match your filter.</p>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: "1px", backgroundColor: "#0f172a" }}>
            {visible.slice(0, 300).map((p) => {
              const { first, last } = splitName(p.fullName);
              const card = POSITION_CARD[p.position] ?? { bg: "bg-slate-800", border: "border-slate-700", text: "#94a3b8", dark: "#1e293b" };
              const isPicking = pickingPlayerId === p.id;
              const isStaged = stagedPlayerId === p.id;
              const queueIdx = queue.indexOf(p.id);
              const isQueued = queueIdx !== -1;
              const isClickable = !pickingPlayerId;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isPicking}
                  onClick={(e) => {
                    if (!isClickable) return;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    onCardClick(p.id, rect);
                  }}
                  style={{ backgroundColor: card.bg }}
                  className={`group relative overflow-hidden text-left transition-all duration-100 ${
                    isStaged ? "brightness-125 ring-2 ring-inset ring-white/50"
                    : isQueued ? "ring-2 ring-inset ring-white/40"
                    : ""
                  } ${isClickable ? "cursor-pointer hover:brightness-110 active:brightness-90" : "cursor-default opacity-40"}`}
                >
                  {/* Queue badge */}
                  {isQueued && !isStaged && (
                    <span className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/40 text-[9px] font-black text-white">
                      {queueIdx + 1}
                    </span>
                  )}
                  {/* Staged badge */}
                  {isStaged && (
                    <span className="absolute right-1 top-1 z-10 rounded bg-black/30 px-1 py-0.5 text-[8px] font-black uppercase text-white">
                      ★
                    </span>
                  )}

                  {/* Card body */}
                  <div className="px-2 pt-1.5 pb-2">
                    {/* Row 1: first name · rank team pos */}
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="w-1/2 truncate text-[10px] font-semibold uppercase leading-none" style={{ color: card.dark, opacity: 0.6 }}>
                        {first}
                      </span>
                      <span className="w-1/2 shrink-0 text-right text-[10px] font-bold leading-none whitespace-nowrap overflow-hidden" style={{ color: card.dark, opacity: 0.65 }}>
                        {p.rank != null && <span className="mr-0.5">{p.rank}</span>}
                        <span>{p.nflTeam ?? "FA"}</span>
                        <span className="font-black ml-0.5">{p.position}</span>
                      </span>
                    </div>
                    {/* Row 2: LAST NAME — 2rem matches FanDraft exactly */}
                    <p className="truncate font-black uppercase leading-tight tracking-tight" style={{ color: card.dark, fontSize: "2rem" }}>
                      {last}
                    </p>
                  </div>

                  {isPicking && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PickRevealModal({
  pick, teams, draftName, leagueLogoUrl, canUndo, onUndo, onClose,
}: {
  pick: DraftPick;
  teams: Team[];
  draftName: string;
  leagueLogoUrl?: string;
  canUndo: boolean;
  onUndo: () => void;
  onClose: () => void;
}) {
  const team = teams.find((t) => t.id === pick.teamId);
  const card = POSITION_CARD[pick.playerPosition] ?? { bg: "#1e293b", border: "#334155", text: "#94a3b8", dark: "#94a3b8" };
  const { first, last } = splitName(pick.playerName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{ maxWidth: 720 }}>

        {/* Top accent bar */}
        <div className="flex items-center justify-between px-6 py-2.5" style={{ background: `linear-gradient(90deg, ${card.text}40, transparent)`, borderBottom: `2px solid ${card.text}50` }}>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">{draftName}</span>
          <span className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: card.text }}>Selection Has Been Made</span>
        </div>

        {/* Main section */}
        <div className="relative flex items-stretch bg-slate-950" style={{ minHeight: 220 }}>
          {/* Left — player info */}
          <div className="flex flex-1 flex-col justify-center px-8 py-8">
            <p className="mb-1 text-xs font-black uppercase tracking-[0.25em]" style={{ color: card.text }}>Selected</p>
            <div className="leading-none">
              <p className="text-3xl font-black uppercase text-white/80 leading-tight">{first}</p>
              <p className="text-6xl font-black uppercase text-white leading-none tracking-tight">{last}</p>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <span className="rounded-lg px-3 py-1.5 text-sm font-black text-slate-950" style={{ backgroundColor: card.text }}>{pick.playerPosition}</span>
              <span className="rounded-lg border border-white/15 bg-white/8 px-3 py-1.5 text-sm font-bold text-slate-300">{pick.nflTeam ?? "FA"}</span>
            </div>
          </div>

          {/* Right — player image slot + league logo */}
          <div className="relative flex w-56 shrink-0 items-end justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, transparent 30%, ${card.text}20 100%)` }}>
            {/* League logo top-right */}
            {leagueLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={leagueLogoUrl}
                alt="League"
                className="absolute right-4 top-4 h-16 w-16 rounded-full object-cover shadow-lg ring-2 ring-white/15"
              />
            )}
            {/* Replace with player image when available */}
            <svg viewBox="0 0 96 144" fill="none" className="h-full w-full opacity-15" aria-hidden="true">
              <ellipse cx="48" cy="36" rx="22" ry="24" fill={card.text}/>
              <path d="M6 144 C6 96 18 80 48 76 C78 80 90 96 90 144Z" fill={card.text}/>
            </svg>
          </div>
        </div>

        {/* Team section */}
        <div className="flex items-center gap-5 border-t border-white/8 bg-slate-900/70 px-8 py-5">
          {/* Team avatar */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/8 text-xl font-black text-white">
            {team?.name?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-black uppercase tracking-tight text-white">{team?.name ?? "—"}</p>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Round {pick.round} · Pick {pick.pickNumber}
            </p>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">Overall</p>
            <p className="text-3xl font-black text-slate-400">#{pick.overallPickNumber}</p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-white/5 bg-black/40 px-6 py-3">
          {/* Placeholder sound/reaction buttons */}
          <div className="flex items-center gap-2">
            {(["😄", "😤"] as const).map((emoji) => (
              <button key={emoji} type="button" title="Coming soon" disabled
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 bg-white/5 text-lg opacity-40 cursor-not-allowed">
                {emoji}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-white/10" />
            {(["SFX 1", "SFX 2"] as const).map((sfx) => (
              <button key={sfx} type="button" title="Coming soon" disabled
                className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-600 opacity-40 cursor-not-allowed">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3"><path d="M5 2.5a2.5 2.5 0 110 7M8 4a4 4 0 010 4"/></svg>
                {sfx}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {canUndo && (
              <button type="button"
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-5 py-2.5 text-sm font-black uppercase tracking-wider text-white hover:bg-white/15 transition-colors"
                onClick={onUndo}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M3 7l-3 3 3 3"/><path d="M0 10h9a4 4 0 000-8H6"/>
                </svg>
                Undo Pick
              </button>
            )}
            <button type="button"
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black uppercase tracking-wider text-slate-950 transition-opacity hover:opacity-90"
              style={{ backgroundColor: card.text }}
              onClick={onClose}>
              Next Pick
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ROUND_POS_COLORS: Record<string, string> = {
  QB: "#38bdf8", RB: "#fbbf24", WR: "#fb923c",
  TE: "#a78bfa", K: "#4ade80", DST: "#f87171",
};

function RoundSummaryView({
  draftId, teams, picks, players, currentPickNumber, rounds, byeWeeks, isCommissioner, onUndoPick,
}: {
  draftId: string;
  teams: Team[];
  picks: DraftPick[];
  players: Player[];
  currentPickNumber: number;
  rounds: number;
  byeWeeks?: Map<string, number>;
  isCommissioner: boolean;
  onUndoPick: () => void;
}) {
  const currentRound = getRoundForPick(currentPickNumber, teams.length);
  const [viewRound, setViewRound] = useState(currentRound);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editSearch, setEditSearch] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const pickedPlayerIds = new Set(picks.map((p) => p.playerId));
  const slots = generateSnakeDraftOrder(teams, rounds).filter((s) => s.round === viewRound);
  const orderedSlots = slots.sort((a, b) => a.overallPickNumber - b.overallPickNumber);

  const editResults = editSearch.trim().length > 1
    ? players
        .filter((p) => !pickedPlayerIds.has(p.id) && p.fullName.toLowerCase().includes(editSearch.toLowerCase()))
        .slice(0, 8)
    : [];

  async function handleEditConfirm(overallPickNumber: number, newPlayerId: string) {
    setIsSaving(true);
    setEditError("");
    try {
      await commissionerEditPick(draftId, overallPickNumber, newPlayerId);
      setEditingSlot(null);
      setEditSearch("");
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update pick.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Round selector tabs */}
      <div className="shrink-0 flex items-center gap-1 overflow-x-auto border-b border-white/5 bg-slate-950/80 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setViewRound(r)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              viewRound === r ? "bg-white text-slate-950" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Round {r}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-slate-950">
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500 w-10">#</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Team</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Player</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Position</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Bye Wk</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Pick</th>
              {isCommissioner && (
                <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-500">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {orderedSlots.map((slot, idx) => {
              const pick = picks.find((p) => p.overallPickNumber === slot.overallPickNumber);
              const posColor = pick ? (ROUND_POS_COLORS[pick.playerPosition] ?? "#94a3b8") : null;
              const byeWeek = pick?.nflTeam ? (byeWeeks?.get(pick.nflTeam) ?? null) : null;
              const isEven = idx % 2 === 1;
              const isEditing = editingSlot === slot.overallPickNumber;

              return (
                <tr
                  key={slot.overallPickNumber}
                  className="border-b border-white/5"
                  style={{ backgroundColor: isEditing ? "rgba(20,184,166,0.06)" : isEven ? "rgba(255,255,255,0.02)" : "transparent" }}
                >
                  <td className="px-4 py-3 text-xs font-bold text-slate-600">{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-300">{slot.teamName}</td>
                  <td className="px-4 py-3 font-semibold text-white">
                    {isEditing ? (
                      <div className="relative">
                        <input
                          autoFocus
                          type="text"
                          value={editSearch}
                          onChange={(e) => setEditSearch(e.target.value)}
                          placeholder="Search player…"
                          className="w-full rounded-lg border border-teal-500/40 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-600 outline-none focus:border-teal-500"
                        />
                        {editResults.length > 0 && (
                          <div className="absolute top-full left-0 z-50 mt-1 w-72 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                            {editResults.map((p) => {
                              const pc = ROUND_POS_COLORS[p.position] ?? "#94a3b8";
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleEditConfirm(slot.overallPickNumber, p.id)}
                                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/5 disabled:opacity-50"
                                >
                                  <span className="text-sm font-semibold text-white">{p.fullName}</span>
                                  <span className="text-xs font-black ml-2" style={{ color: pc }}>{p.position}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {editError && <p className="mt-1 text-xs text-red-400">{editError}</p>}
                      </div>
                    ) : pick ? pick.playerName : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {pick && !isEditing ? (
                      <span className="rounded px-2 py-0.5 text-xs font-black" style={{ color: posColor ?? "#94a3b8", backgroundColor: `${posColor}18` }}>
                        {pick.playerPosition}
                      </span>
                    ) : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {!isEditing && (byeWeek ?? <span className="text-slate-700">—</span>)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-bold">
                    {viewRound}.{idx + 1}
                  </td>
                  {isCommissioner && (
                    <td className="px-4 py-3 text-right">
                      {pick && (
                        isEditing ? (
                          <button
                            type="button"
                            onClick={() => { setEditingSlot(null); setEditSearch(""); setEditError(""); }}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-400 transition-colors hover:bg-white/10"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingSlot(slot.overallPickNumber); setEditSearch(""); setEditError(""); }}
                            className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-black text-teal-400 transition-colors hover:bg-teal-500/20"
                          >
                            Edit
                          </button>
                        )
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RosterBoardView({ teams, picks }: { teams: Team[]; picks: DraftPick[] }) {
  const picksByTeam = new Map(teams.map((t) => [t.id, picks.filter((p) => p.teamId === t.id).sort((a, b) => a.round - b.round)]));
  return (
    <div className="overflow-x-auto p-3">
      <div className="flex gap-3" style={{ minWidth: `${teams.length * 160}px` }}>
        {teams.map((team) => {
          const roster = picksByTeam.get(team.id) ?? [];
          return (
            <div key={team.id} className="w-40 shrink-0 rounded-xl border border-white/8 bg-slate-900/60 overflow-hidden">
              <div className="border-b border-white/8 px-3 py-2">
                <p className="truncate text-xs font-black uppercase tracking-wide text-slate-200">{team.name}</p>
                <p className="text-[10px] text-slate-600">{roster.length} picks</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {roster.map((pick) => (
                  <div key={pick.id} className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold" style={{ color: POSITION_COLORS[pick.playerPosition] ?? "#94a3b8" }}>{pick.playerPosition}</span>
                      <span className="text-[10px] text-slate-600">Rd {pick.round}</span>
                    </div>
                    <p className="truncate text-xs font-semibold text-white">{pick.playerName}</p>
                    <p className="text-[10px] text-slate-600">{pick.nflTeam ?? "FA"}</p>
                  </div>
                ))}
                {roster.length === 0 && <p className="px-3 py-3 text-[11px] text-slate-700">No picks yet</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
