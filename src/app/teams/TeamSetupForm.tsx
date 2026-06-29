"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  assignTeam,
  configureDraftTimer,
  getDraftSetup,
  inviteOwner,
  resetDraft,
  updateDraftName,
  updateDraftExtras,
  updateDraftAudio,
  updateDraftPresentation,
  uploadDraftSfx,
  uploadDraftPresentationAudio,
  updateDraftRounds,
  updateDraftRosterPositions,
  updateDraftSchedule,
  updateDraftTeamCount,
  updateTeamDetails,
  updateTeamSetup,
  uploadDraftTeamLogo,
  uploadDraftOwnerPhoto,
  type DraftSetup,
} from "@/lib/draftApi";
import { getAssignedTeamIds } from "@/lib/participantLogic";
import { buildOwnerInvitationMessage } from "@/lib/ownerInvitation";
import { shouldRefreshDraftOnVisibility } from "@/lib/draftRecovery";
import { moveDraftTeam } from "@/lib/teamSetupLogic";
import { supabase } from "@/lib/supabase";
import { getLeagueBranding, inviteLeagueMember } from "@/lib/leagueApi";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { getAnnouncerVoiceProfile, resolveAnnouncerVoice } from "@/lib/speech";
import ClockSettings from "@/components/ClockSettings";
import SongPicker from "@/components/SongPicker";
import ResetDraftModal from "@/components/ResetDraftModal";
import { initiateSpotifyPopup, isSpotifyConnected, disconnectSpotify, consumeSpotifyCallback } from "@/lib/spotifyAuth";
import type { DraftInvitation, RosterPosition, Team, TimerBehavior, WalkUpSong } from "@/types/draft";

const DEFAULT_ROSTER_POSITIONS: RosterPosition[] = [
  { id: "QB", label: "Quarterbacks", abbrev: "QB", enabled: true, min: 0, max: 9, color: "#67E8F9" },
  { id: "RB", label: "Running backs", abbrev: "RB", enabled: true, min: 0, max: 9, color: "#FCD34D" },
  { id: "WR", label: "Wide Receivers", abbrev: "WR", enabled: true, min: 0, max: 9, color: "#F97316" },
  { id: "TE", label: "Tight End", abbrev: "TE", enabled: true, min: 0, max: 9, color: "#A78BFA" },
  { id: "K", label: "Kickers", abbrev: "K", enabled: true, min: 0, max: 9, color: "#4ADE80" },
  { id: "DST", label: "Defense / ST", abbrev: "Def", enabled: true, min: 0, max: 9, color: "#F87171" },
  { id: "IDP", label: "Individual Def. Players", abbrev: "IDP", enabled: false, min: 0, max: 9, color: "#C4A4A4" },
  { id: "FLEX", label: "Flex (W/R/T)", abbrev: "FLX", enabled: false, min: 0, max: 9, color: "#94A3B8" },
  { id: "SUPERFLEX", label: "Superflex (Q/W/R/T)", abbrev: "SF", enabled: false, min: 0, max: 9, color: "#818CF8" },
  { id: "OP", label: "Offensive Player", abbrev: "OP", enabled: false, min: 0, max: 9, color: "#FCA5A5" },
  { id: "DL", label: "Defensive Line", abbrev: "DL", enabled: false, min: 0, max: 9, color: "#86EFAC" },
  { id: "LB", label: "Linebacker", abbrev: "LB", enabled: false, min: 0, max: 9, color: "#93C5FD" },
  { id: "DB", label: "Defensive Back", abbrev: "DB", enabled: false, min: 0, max: 9, color: "#FDE68A" },
  { id: "BN", label: "Bench", abbrev: "BN", enabled: false, min: 0, max: 9, color: "#475569" },
  { id: "IR", label: "Injured Reserve", abbrev: "IR", enabled: false, min: 0, max: 9, color: "#7F1D1D" },
];
const ROSTER_POSITIONS_COLLAPSED = 7;

type Tab = "settings" | "teams" | "draft-order" | "audio";

interface TeamSetupFormProps {
  draftId: string | null;
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(el);
  el.select();
  el.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(el);
  }
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}:${String(s).padStart(2, "0")}`;
}

const BEHAVIOR_LABELS: Record<string, string> = {
  nothing: "Nothing happens",
  skip: "Skip pick",
  auto_draft: "Auto-draft",
};

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-slate-600" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}


export default function TeamSetupForm({ draftId }: TeamSetupFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab | null) ?? "teams";
  const leagueSlug = searchParams.get("leagueSlug");
  const fromDraft = searchParams.get("fromDraft") === "1";
  const backHref = leagueSlug ? `/leagues/${leagueSlug}` : "/dashboard";
  const backToDraftHref = draftId
    ? `/draft/lobby?draftId=${draftId}${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`
    : null;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [setup, setSetup] = useState<DraftSetup | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assigningParticipantId, setAssigningParticipantId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [isSavingClock, setIsSavingClock] = useState(false);
  const [showResetDraft, setShowResetDraft] = useState(false);

  // Settings tab — draft name / format editing
  const [draftName, setDraftName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
  const [lastSeasonOpen, setLastSeasonOpen] = useState<Set<string>>(new Set());
  const [songPickerTeamId, setSongPickerTeamId] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  useEffect(() => {
    // Consume OAuth tokens from URL fragment after redirect back from Spotify
    if (consumeSpotifyCallback()) setSpotifyConnected(true);
    else setSpotifyConnected(isSpotifyConnected());
  }, []);
  const [rounds, setRounds] = useState(15);
  const [isSavingRounds, setIsSavingRounds] = useState(false);
  const [teamCount, setTeamCount] = useState(10);
  const [isSavingTeamCount, setIsSavingTeamCount] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledTimezone, setScheduledTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [rosterPositions, setRosterPositions] = useState<RosterPosition[]>(DEFAULT_ROSTER_POSITIONS);
  const [showAllPositions, setShowAllPositions] = useState(false);
  const [scoringType, setScoringType] = useState<"standard" | "ppr" | "half_ppr" | "superflex">("standard");
  const [useLandmines, setUseLandmines] = useState(false);
  const [landmineCount, setLandmineCount] = useState(3);
  const [sfx1Url, setSfx1Url] = useState("");
  const [sfx2Url, setSfx2Url] = useState("");
  const [posReactions, setPosReactions] = useState(["That was a great pick!", "What a steal!", "Excellent choice!"]);
  const [negReactions, setNegReactions] = useState(["Oh no! What were you thinking?", "Really? You chose him?", "That was a horrible pick!"]);
  const [isSavingAudio, setIsSavingAudio] = useState(false);
  const [sfxUploading, setSfxUploading] = useState<{ 1: boolean; 2: boolean }>({ 1: false, 2: false });
  // Presentation settings
  const [pickIsInEnabled, setPickIsInEnabled] = useState(true);
  const [pickIsInSfxUrl, setPickIsInSfxUrl] = useState<string | null>(null);
  const [pickIsInUploading, setPickIsInUploading] = useState(false);
  const [draftStartAudioUrl, setDraftStartAudioUrl] = useState<string | null>(null);
  const [draftStartUploading, setDraftStartUploading] = useState(false);
  // Round slide settings
  const [showRoundSlide, setShowRoundSlide] = useState(true);
  const [roundSlideSeconds, setRoundSlideSeconds] = useState(7);
  const [roundSlidePausesClock, setRoundSlidePausesClock] = useState(false);
  // Announcer voice
  const [announcerVoiceUri, setAnnouncerVoiceUri] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [settingsSaveState, setSettingsSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [error, setError] = useState("");

  const { accentColor: primary, bgColor: secondary, setAccentColor, setBgColor } = useLeagueTheme();

  useEffect(() => {
    if (!leagueSlug) return;
    void getLeagueBranding(leagueSlug).then((b) => {
      if (b?.primaryColor) setAccentColor(b.primaryColor);
      if (b?.secondaryColor) setBgColor(b.secondaryColor);
    });
  }, [leagueSlug, setAccentColor, setBgColor]);

  useEffect(() => {
    if (!draftId) { router.replace("/create"); return; }

    let cancelled = false;
    void getDraftSetup(draftId).then((s) => {
      if (!cancelled) {
        setSetup(s); setTeams(s.teams); setDraftName(s.draft.name);
        setRounds(s.draft.rounds); setTeamCount(s.draft.teamCount);
        if (s.draft.scheduledAt) {
          const dt = new Date(s.draft.scheduledAt);
          setScheduledDate(dt.toISOString().slice(0, 10));
          setScheduledTime(dt.toISOString().slice(11, 16));
        }
        if (s.draft.scheduledTimezone) setScheduledTimezone(s.draft.scheduledTimezone);
        setScoringType(s.draft.scoringType ?? "standard");
        setUseLandmines(s.draft.useLandmines ?? false);
        setLandmineCount(s.draft.landmineCount ?? 3);
        if (s.draft.sfx1Url) setSfx1Url(s.draft.sfx1Url);
        if (s.draft.sfx2Url) setSfx2Url(s.draft.sfx2Url);
        if (s.draft.posReactions?.length) setPosReactions(s.draft.posReactions);
        if (s.draft.negReactions?.length) setNegReactions(s.draft.negReactions);
        setPickIsInEnabled(s.draft.pickIsInEnabled ?? true);
        setPickIsInSfxUrl(s.draft.pickIsInSfxUrl ?? null);
        setDraftStartAudioUrl(s.draft.draftStartAudioUrl ?? null);
        setShowRoundSlide(s.draft.showRoundSlide ?? true);
        setRoundSlideSeconds(s.draft.roundSlideSeconds ?? 7);
        setRoundSlidePausesClock(s.draft.roundSlidePausesClock ?? false);
        setAnnouncerVoiceUri(s.draft.announcerVoiceUri ?? null);
        if (s.draft.rosterPositions?.length) {
          setRosterPositions(
            DEFAULT_ROSTER_POSITIONS.map((def) => {
              const saved = s.draft.rosterPositions!.find((p) => p.id === def.id);
              return saved ? { ...def, ...saved } : def;
            })
          );
        }
      }
    }).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load draft.");
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [draftId, router]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => setAvailableVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
    if (!draftId) return;
    let active = true;
    let inFlight = false;
    let queued = false;

    const refresh = async () => {
      if (inFlight) { queued = true; return; }
      inFlight = true;
      do {
        queued = false;
        try {
          const s = await getDraftSetup(draftId);
          if (active) {
            setSetup(s);
            setTeams(s.teams);
            setDraftName((prev) => prev === s.draft.name ? prev : s.draft.name);
            setError("");
          }
        } catch (e) {
          if (active) setError(e instanceof Error ? e.message : "Unable to refresh.");
        }
      } while (active && queued);
      inFlight = false;
    };

    const channel = supabase
      .channel(`team-setup:${draftId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_participants", filter: `draft_id=eq.${draftId}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_invitations", filter: `draft_id=eq.${draftId}` }, () => void refresh())
      .subscribe((s) => { if (s === "SUBSCRIBED") void refresh(); });

    const onVisible = () => {
      if (shouldRefreshDraftOnVisibility(document.visibilityState, navigator.onLine)) void refresh();
    };
    const pollId = window.setInterval(onVisible, 10_000);
    window.addEventListener("online", onVisible);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      window.clearInterval(pollId);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [draftId]);

  function updateTeam(teamId: string, value: string) {
    setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, name: value } : t));
  }

  function updateTeamField<K extends keyof typeof teams[number]>(teamId: string, field: K, value: typeof teams[number][K]) {
    setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, [field]: value } : t));
  }

  function moveTeam(index: number, offset: -1 | 1) {
    setTeams((prev) => moveDraftTeam(prev, index, offset));
  }

  async function refreshParticipants() {
    if (!draftId) return;
    setIsRefreshing(true);
    try {
      const s = await getDraftSetup(draftId);
      setSetup(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to refresh.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function saveDraftName() {
    if (!draftId || !setup) return;
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === setup.draft.name) return;
    setIsSavingName(true);
    try {
      const updated = await updateDraftName(draftId, trimmed);
      setSetup({ ...setup, draft: updated });
      setDraftName(updated.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update draft name.");
      setDraftName(setup.draft.name);
    } finally {
      setIsSavingName(false);
    }
  }

  async function updateAssignment(participantId: string, teamId: string) {
    if (!draftId || !setup) return;
    setAssigningParticipantId(participantId);
    try {
      const updated = await assignTeam(draftId, participantId, teamId || null);
      setSetup({ ...setup, participants: setup.participants.map((p) => p.id === participantId ? updated : p) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to assign team.");
    } finally {
      setAssigningParticipantId(null);
    }
  }

  async function copyJoinLink() {
    if (!setup) return;
    const url = `${window.location.origin}/join/${setup.draft.joinCode}`;
    setCopyStatus((await copyText(url)) ? "Copied!" : `Copy manually: ${url}`);
    setTimeout(() => setCopyStatus(""), 2500);
  }

  async function sendEmailInvitation(event: React.FormEvent<HTMLFormElement>, teamIdOverride?: string) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const sendEmail = submitter?.getAttribute("data-delivery") !== "manual";
    const targetTeamId = teamIdOverride ?? inviteTeamId;
    if (!draftId || !setup || !inviteEmail.trim() || !targetTeamId) return;
    setIsInviting(true);
    try {
      // Save the team state first so name changes are persisted
      await updateTeamSetup(draftId, teams);

      if (setup.draft.leagueId) {
        const leagueInvitation = await inviteLeagueMember(
          setup.draft.leagueId,
          inviteEmail.trim(),
          { draftTeamId: targetTeamId }
        );
        const invitedTeam = teams.find((team) => team.id === targetTeamId);
        if (!sendEmail && invitedTeam) {
          const message = `You are invited to join ${setup.draft.name} in DraftHQ as ${invitedTeam.name}.\n\nOpen DraftHQ to accept or decline:\n${leagueInvitation.inviteUrl}`;
          setCopyStatus((await copyText(message)) ? `Invite for ${inviteEmail.trim()} copied.` : `Copy manually:\n${message}`);
        } else {
          setCopyStatus(leagueInvitation.warning ?? "League invitation sent. They must accept before joining or receiving the team.");
        }
        setInviteEmail("");
        setInviteTeamId("");
        setTimeout(() => setCopyStatus(""), 4500);
        return;
      }

      const result = await inviteOwner(draftId, inviteEmail.trim(), targetTeamId, { sendEmail });
      const { invitation } = result;
      const invitedTeam = teams.find((t) => t.id === invitation.teamId);
      const idx = setup.invitations.findIndex((i) => i.id === invitation.id);
      const invitations = idx === -1
        ? [...setup.invitations, invitation]
        : setup.invitations.map((i) => i.id === invitation.id ? invitation : i);
      setSetup({ ...setup, invitations });
      setInviteEmail(""); setInviteTeamId("");
      if (!sendEmail && invitedTeam) {
        await copyOwnerInviteDetails(invitation, invitedTeam);
      } else {
        setCopyStatus(result.warning ? `${result.warning} Use Copy Invite below.` : "Invitation sent.");
        setTimeout(() => setCopyStatus(""), 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send invitation.");
    } finally {
      setIsInviting(false);
    }
  }

  async function copyOwnerInvite(invitationId: string) {
    const inv = setup?.invitations.find((i) => i.id === invitationId);
    const team = teams.find((t) => t.id === inv?.teamId);
    if (!setup || !inv || !team) return;
    await copyOwnerInviteDetails(inv, team);
  }

  async function copyOwnerInviteDetails(invitation: DraftInvitation, team: Team) {
    if (!setup) return;
    const url = `${window.location.origin}/join/${setup.draft.joinCode}`;
    const msg = buildOwnerInvitationMessage({ draftName: setup.draft.name, teamName: team.name, email: invitation.email, joinUrl: url });
    setCopyStatus((await copyText(msg)) ? `Invite for ${invitation.email} copied.` : `Copy manually:\n${msg}`);
    setTimeout(() => setCopyStatus(""), 3000);
  }

  async function saveClockSettings(settings: {
    pickSeconds: number;
    timerBehavior: TimerBehavior;
    clockExtensionSeconds: number;
    maxClockExtensions: number;
  }) {
    if (!draftId || !setup) return;
    setIsSavingClock(true);
    setSettingsSaveState("saving");
    try {
      const updated = await configureDraftTimer(draftId, settings.pickSeconds, {
        timerBehavior: settings.timerBehavior,
        clockExtensionSeconds: settings.clockExtensionSeconds,
        maxClockExtensions: settings.maxClockExtensions,
      });
      setSetup({ ...setup, draft: updated });
      flashSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save clock settings.");
      setSettingsSaveState("idle");
    } finally {
      setIsSavingClock(false);
    }
  }

  async function saveTeam(teamId: string) {
    if (!draftId) return;
    setSavingTeamId(teamId);
    try {
      const team = teams.find((t) => t.id === teamId);
      // updateTeamSetup (name/order) is only allowed before the draft starts
      if (setup?.draft.status === "setup") {
        await updateTeamSetup(draftId, teams);
      }
      if (team) {
        await updateTeamDetails(draftId, teamId, {
          shortName: team.shortName,
          ttsName: team.ttsName,
          autodraft: team.autodraft,
          preDraftNotes: team.preDraftNotes,
          lastSeasonPick: team.lastSeasonPick,
          lastSeasonRecord: team.lastSeasonRecord,
          lastSeasonPlayoffs: team.lastSeasonPlayoffs,
          ownerName: team.ownerName,
          lastSeasonPickPlayer: team.lastSeasonPickPlayer,
          walkUpSongs: (Array.isArray(team.walkUpSongs) ? team.walkUpSongs : []),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Unable to save team.");
    } finally {
      setSavingTeamId(null);
    }
  }

  async function saveWalkUpSongs(teamId: string, songs: WalkUpSong[]) {
    if (!draftId) return;
    try {
      await updateTeamDetails(draftId, teamId, { walkUpSongs: songs });
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Unable to save songs.");
    }
  }

  function flashSaved() {
    if (settingsSaveTimerRef.current) clearTimeout(settingsSaveTimerRef.current);
    setSettingsSaveState("saved");
    settingsSaveTimerRef.current = setTimeout(() => setSettingsSaveState("idle"), 2000);
  }

  function saveRosterPositions(updated: RosterPosition[]) {
    setRosterPositions(updated);
    if (!draftId || !setup) return;
    setSettingsSaveState("saving");
    updateDraftRosterPositions(draftId, updated)
      .then((draft) => { setSetup({ ...setup, draft }); flashSaved(); })
      .catch((e) => { setError(e instanceof Error ? e.message : "Unable to save roster positions."); setSettingsSaveState("idle"); });
  }

  async function saveTeams() {
    if (!draftId) return;
    if (teams.some((t) => !t.name.trim())) { setError("Every team must have a name."); return; }
    setError(""); setIsSaving(true);
    try {
      await updateTeamSetup(draftId, teams);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Unable to save teams.");
    } finally {
      setIsSaving(false);
    }
  }

  async function continueToDraft() {
    if (!draftId) return;
    if (teams.some((t) => !t.name.trim())) { setError("Every team must have a name."); return; }
    setError(""); setIsSaving(true);
    try {
      await updateTeamSetup(draftId, teams);
      router.push(`/draft/lobby?draftId=${draftId}${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Unable to save teams.");
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">Loading draft...</p>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-400">{error || "Unable to load draft setup."}</p>
      </div>
    );
  }

  const isCommissioner = setup.currentUserId === setup.draft.commissionerUserId;
  const canManageAssignments = setup.draft.status === "setup" || setup.draft.status === "paused";
  const draft = setup.draft;
  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join/${draft.joinCode}`
    : `/join/${draft.joinCode}`;
  const isDraftNameDirty = draftName.trim() !== draft.name && draftName.trim() !== "";

  const TABS: { id: Tab; label: string }[] = [
    { id: "settings", label: "Settings" },
    { id: "teams", label: "Teams" },
    { id: "draft-order", label: "Draft Order" },
    { id: "audio", label: "Audio / Video" },
  ];

  const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-teal-500 focus:outline-none disabled:opacity-50 transition-colors";
  const labelCls = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5";
  const cardCls = "rounded-2xl border border-slate-800 bg-slate-900 p-6";

  return (
    <>
    <div className="flex-1 text-white">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-[#020617]/95 backdrop-blur">
        <div className="flex items-center gap-3 px-6 py-3">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M10.5 3L5.5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <span className="font-bold text-white">{draft.name}</span>

          <div className="ml-auto flex items-center gap-3">
            {fromDraft && backToDraftHref ? (
              <Link
                href={backToDraftHref}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90"
                style={{ backgroundColor: primary, color: secondary }}
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path d="M10.5 3L5.5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back to Draft
              </Link>
            ) : (
              <>
                <span className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pre-Draft
                </span>
                <button
                  type="button"
                  onClick={() => void continueToDraft()}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: primary, color: secondary }}
                >
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M6 5h4M6 8h4M6 11h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Enter Draft Room
                </button>
                {isCommissioner && leagueSlug && (
                  <button
                    type="button"
                    onClick={() => setShowResetDraft(true)}
                    className="rounded-lg border border-red-800/70 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-950/40 hover:text-red-300"
                  >
                    Reset Draft
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <nav className="flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="border-b-2 px-5 py-3 text-sm font-medium transition-colors"
                style={tab === t.id
                  ? { borderColor: primary, color: primary }
                  : { borderColor: "transparent", color: "#64748b" }
                }
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {showResetDraft && draftId && (
        <ResetDraftModal
          onClose={() => setShowResetDraft(false)}
          onConfirm={async () => {
            await resetDraft(draftId);
            const freshSetup = await getDraftSetup(draftId);
            setSetup(freshSetup);
            setTeams(freshSetup.teams);
            setTab("settings");
            router.replace(`/teams?draftId=${draftId}&tab=settings&leagueSlug=${leagueSlug}`);
          }}
          onReset={() => undefined}
        />
      )}

      {/* ── Body ── */}
      <div className="mx-auto max-w-5xl px-6 py-8 pb-24 lg:pb-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {copyStatus && (
          <div className="mb-6 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: primary + "55", backgroundColor: primary + "15", color: primary }}>
            {copyStatus}
          </div>
        )}

        <div className={`grid gap-8 ${tab === "settings" ? "lg:grid-cols-[1fr_260px]" : ""}`}>

          {/* ── Main content ── */}
          <div>

            {/* SETTINGS TAB */}
            {tab === "settings" && (
              <div className="space-y-5">

                <div className={cardCls}>
                  <p className="text-base font-bold text-white">Draft details</p>
                  <p className="mt-0.5 text-xs text-slate-500 mb-5">Name and invite link for your draft.</p>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="draft-name" className={labelCls}>Draft name</label>
                      <div className="flex gap-2">
                        <input
                          id="draft-name"
                          ref={nameInputRef}
                          type="text"
                          maxLength={80}
                          disabled={!isCommissioner || isSavingName}
                          className={inputCls}
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onBlur={() => { if (isDraftNameDirty) void saveDraftName(); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void saveDraftName(); nameInputRef.current?.blur(); } }}
                        />
                        {isDraftNameDirty && (
                          <button
                            type="button"
                            disabled={isSavingName}
                            onClick={() => void saveDraftName()}
                            className="shrink-0 rounded-lg px-3 text-xs font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
                            style={{ backgroundColor: primary, color: secondary }}
                          >
                            {isSavingName ? "..." : "Save"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className={labelCls}>Join code</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-mono text-lg font-bold tracking-[0.25em] text-white">
                          {draft.joinCode}
                        </span>
                        <button
                          type="button"
                          onClick={copyJoinLink}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                          Copy link
                        </button>
                        <a
                          href={joinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs transition-opacity hover:opacity-80"
                          style={{ color: primary }}
                        >
                          Open ↗
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cardCls}>
                  <p className="text-base font-bold text-white">Draft format</p>
                  <p className="mt-0.5 text-xs text-slate-500 mb-5">Changing teams will add or remove slots from the draft order.</p>

                  <div className="grid gap-5 sm:grid-cols-2 mb-5">
                    <div>
                      <label className={labelCls}>Teams</label>
                      <div className="flex items-center gap-2">
                        <select
                          disabled={!isCommissioner || isSavingTeamCount}
                          className="w-full disabled:opacity-50"
                          value={teamCount}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTeamCount(val);
                            if (draftId && setup) {
                              setIsSavingTeamCount(true);
                              updateDraftTeamCount(draftId, val)
                                .then((updated) => import("@/lib/draftApi").then((m) => m.getDraftSetup(draftId)).then((fresh) => {
                                  setSetup({ ...fresh, draft: updated });
                                  setTeams(fresh.teams);
                                }))
                                .catch((e) => { setError(e instanceof Error ? e.message : "Unable to update teams."); setTeamCount(setup.draft.teamCount); })
                                .finally(() => setIsSavingTeamCount(false));
                            }
                          }}
                        >
                          {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                            <option key={n} value={n}>{n} teams</option>
                          ))}
                        </select>
                        {isSavingTeamCount && <span className="shrink-0 text-xs text-slate-500">Saving...</span>}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Rounds</label>
                      <div className="flex items-center gap-2">
                        <select
                          disabled={!isCommissioner || isSavingRounds}
                          className="w-full disabled:opacity-50"
                          value={rounds}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setRounds(val);
                            if (draftId && setup) {
                              setIsSavingRounds(true);
                              updateDraftRounds(draftId, val)
                                .then((updated) => setSetup({ ...setup, draft: updated }))
                                .catch((e) => { setError(e instanceof Error ? e.message : "Unable to update rounds."); setRounds(setup.draft.rounds); })
                                .finally(() => setIsSavingRounds(false));
                            }
                          }}
                        >
                          {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{n} rounds</option>
                          ))}
                        </select>
                        {isSavingRounds && <span className="shrink-0 text-xs text-slate-500">Saving...</span>}
                      </div>
                    </div>
                  </div>

                  <hr className="mb-5 border-slate-800" />

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className={labelCls} style={{ marginBottom: 0 }}>Draft style</p>
                      {fromDraft && (
                        <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Locked during draft
                        </span>
                      )}
                    </div>
                    <div className={`space-y-2 ${fromDraft ? "pointer-events-none opacity-50" : ""}`}>
                      {/* Regular / Snake — active */}
                      <div className="flex items-start gap-3 rounded-xl border px-4 py-3" style={{ borderColor: primary + "55", backgroundColor: primary + "15" }}>
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: primary }}>
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: primary }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">Regular</p>
                          <p className="text-xs text-slate-500">Teams take turns selecting players (snake/serpentine order).</p>
                        </div>
                      </div>
                      {/* Auction — coming soon */}
                      <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 opacity-50 cursor-not-allowed">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-slate-600" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-400">Auction</p>
                            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Coming soon</span>
                          </div>
                          <p className="text-xs text-slate-600">Teams bid on players during nominations.</p>
                        </div>
                      </div>
                      {/* Combo — coming soon */}
                      <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 opacity-50 cursor-not-allowed">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-slate-600" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-400">Combo / Half-and-Half</p>
                            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Coming soon</span>
                          </div>
                          <p className="text-xs text-slate-600">Auction rounds followed by regular snake rounds.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="my-5 border-slate-800" />

                  <div>
                    <p className={labelCls}>Clock settings</p>
                    <ClockSettings
                      draft={draft}
                      disabled={isSavingClock}
                      onSave={(s) => void saveClockSettings(s)}
                    />
                    {isSavingClock && <p className="mt-2 text-xs text-slate-500">Saving...</p>}
                  </div>

                  <hr className="my-5 border-slate-800" />

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className={labelCls} style={{ marginBottom: 0 }}>Draft date</p>
                      <span className="mb-1.5 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-400" title="Optional — set a date/time to share with team owners">?</span>
                    </div>
                    <p className="mb-3 text-xs text-slate-500">Optional — set a date/time to share with owners.</p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className={labelCls}>Date</label>
                        <input
                          type="date"
                          disabled={!isCommissioner || isSavingSchedule}
                          className={inputCls}
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          onBlur={() => {
                            if (!draftId || !setup || !scheduledDate) return;
                            setIsSavingSchedule(true);
                            const iso = new Date(`${scheduledDate}T${scheduledTime || "00:00"}`).toISOString();
                            updateDraftSchedule(draftId, iso, scheduledTimezone)
                              .then((updated) => setSetup({ ...setup, draft: updated }))
                              .catch((e) => setError(e instanceof Error ? e.message : "Unable to save schedule."))
                              .finally(() => setIsSavingSchedule(false));
                          }}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Time</label>
                        <input
                          type="time"
                          disabled={!isCommissioner || isSavingSchedule || !scheduledDate}
                          className={inputCls}
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          onBlur={() => {
                            if (!draftId || !setup || !scheduledDate) return;
                            setIsSavingSchedule(true);
                            const iso = new Date(`${scheduledDate}T${scheduledTime || "00:00"}`).toISOString();
                            updateDraftSchedule(draftId, iso, scheduledTimezone)
                              .then((updated) => setSetup({ ...setup, draft: updated }))
                              .catch((e) => setError(e instanceof Error ? e.message : "Unable to save time."))
                              .finally(() => setIsSavingSchedule(false));
                          }}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Timezone</label>
                        <select
                          disabled={!isCommissioner || isSavingSchedule}
                          className="w-full disabled:opacity-50"
                          value={scheduledTimezone}
                          onChange={(e) => {
                            setScheduledTimezone(e.target.value);
                            if (!draftId || !setup || !scheduledDate) return;
                            setIsSavingSchedule(true);
                            const iso = new Date(`${scheduledDate}T${scheduledTime || "00:00"}`).toISOString();
                            updateDraftSchedule(draftId, iso, e.target.value)
                              .then((updated) => setSetup({ ...setup, draft: updated }))
                              .catch((e) => setError(e instanceof Error ? e.message : "Unable to save timezone."))
                              .finally(() => setIsSavingSchedule(false));
                          }}
                        >
                          {[
                            "America/New_York",
                            "America/Chicago",
                            "America/Denver",
                            "America/Los_Angeles",
                            "America/Phoenix",
                            "America/Anchorage",
                            "Pacific/Honolulu",
                            "Europe/London",
                            "Europe/Paris",
                            "Australia/Sydney",
                          ].map((tz) => (
                            <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {scheduledDate && (
                      <button
                        type="button"
                        className="mt-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
                        onClick={() => {
                          setScheduledDate(""); setScheduledTime("");
                          if (!draftId || !setup) return;
                          void updateDraftSchedule(draftId, null, null)
                            .then((updated) => setSetup({ ...setup, draft: updated }));
                        }}
                      >
                        Clear date
                      </button>
                    )}
                    {isSavingSchedule && <p className="mt-1 text-xs text-slate-500">Saving...</p>}
                  </div>
                </div>

                {/* ── Roster Positions ── */}
                <div className={cardCls}>
                  <p className="text-base font-bold text-white">Roster positions</p>
                  <p className="mt-0.5 text-xs text-slate-500 mb-5">Choose which positions exist and how many can be rostered.</p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 w-full">Position</th>
                          <th className="pb-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Use</th>
                          <th className="pb-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Minimum</th>
                          <th className="pb-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Maximum</th>
                          <th className="pb-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Color</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {(showAllPositions ? rosterPositions : rosterPositions.slice(0, ROSTER_POSITIONS_COLLAPSED)).map((pos) => (
                          <tr key={pos.id} className={pos.enabled ? "" : "opacity-50"}>
                            <td className="py-3 pr-4">
                              <p className="font-semibold text-white leading-tight">{pos.label}</p>
                              <p className="text-xs text-slate-500">{pos.abbrev}</p>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                disabled={!isCommissioner}
                                checked={pos.enabled}
                                onChange={(e) => {
                                  const next = rosterPositions.map((p) =>
                                    p.id === pos.id ? { ...p, enabled: e.target.checked } : p
                                  );
                                  saveRosterPositions(next);
                                }}
                                className="h-4 w-4 rounded accent-teal-500"
                              />
                            </td>
                            <td className="py-3 px-3 text-center">
                              <select
                                disabled={!isCommissioner || !pos.enabled}
                                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white disabled:opacity-40"
                                value={pos.min}
                                onChange={(e) => {
                                  const next = rosterPositions.map((p) =>
                                    p.id === pos.id ? { ...p, min: Number(e.target.value) } : p
                                  );
                                  saveRosterPositions(next);
                                }}
                              >
                                {Array.from({ length: 10 }, (_, i) => (
                                  <option key={i} value={i}>{i}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <select
                                disabled={!isCommissioner || !pos.enabled}
                                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white disabled:opacity-40"
                                value={pos.max}
                                onChange={(e) => {
                                  const next = rosterPositions.map((p) =>
                                    p.id === pos.id ? { ...p, max: Number(e.target.value) } : p
                                  );
                                  saveRosterPositions(next);
                                }}
                              >
                                {Array.from({ length: 10 }, (_, i) => (
                                  <option key={i} value={i}>{i}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="color"
                                disabled={!isCommissioner || !pos.enabled}
                                value={pos.color}
                                onChange={(e) => {
                                  const next = rosterPositions.map((p) =>
                                    p.id === pos.id ? { ...p, color: e.target.value } : p
                                  );
                                  setRosterPositions(next);
                                }}
                                onBlur={(e) => {
                                  const next = rosterPositions.map((p) =>
                                    p.id === pos.id ? { ...p, color: e.target.value } : p
                                  );
                                  saveRosterPositions(next);
                                }}
                                className="h-8 w-14 cursor-pointer rounded border border-slate-700 bg-transparent p-0.5 disabled:opacity-40"
                                title={`Color for ${pos.label}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAllPositions((v) => !v)}
                    className="mt-4 flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ color: primary }}
                  >
                    <svg className={`h-4 w-4 transition-transform ${showAllPositions ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {showAllPositions ? "Show fewer positions" : "Show more positions"}
                  </button>
                </div>

                {/* ── Draft room theme ── */}
                <div className={cardCls}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-bold text-white">Draft Room Theme</p>
                      <p className="mt-0.5 text-xs text-slate-500">Control the visual style of the live draft room.</p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Coming soon</span>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-3 opacity-40 pointer-events-none select-none">
                    {["Classic", "Broadcast", "Dark", "Modern"].map((t) => (
                      <div key={t} className="rounded-xl border px-3 py-3 text-center text-sm font-semibold"
                        style={t === "Classic" ? { borderColor: primary + "66", backgroundColor: primary + "15", color: primary } : { borderColor: "#334155", backgroundColor: "rgba(30,41,59,0.4)", color: "#94a3b8" }}
                      >
                        {t}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Visibility & extras ── */}
                <div className={cardCls}>
                  <p className="text-base font-bold text-white">Visibility &amp; extras</p>
                  <p className="mt-0.5 text-xs text-slate-500 mb-5">Optional controls that affect what owners see and can do.</p>

                  <div className="divide-y divide-slate-800">
                    {/* Player Whammies */}
                    <div className="grid gap-4 py-5 sm:grid-cols-2 first:pt-0">
                      <div>
                        <p className="font-semibold text-white text-sm">Landmines</p>
                        <p className="mt-0.5 text-xs text-slate-500">Mystery player picks hidden until draft ends.</p>
                      </div>
                      <div>
                        <p className="mb-3 text-sm text-slate-400">
                          Each team is assigned a set number of pick slots where the player selection stays hidden from opponents until the draft ends.
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isCommissioner}
                            checked={useLandmines}
                            onChange={(e) => {
                              setUseLandmines(e.target.checked);
                              if (!draftId || !setup) return;
                              void updateDraftExtras(draftId, { useLandmines: e.target.checked })
                                .then((d) => setSetup({ ...setup, draft: d }))
                                .catch((err) => setError(err instanceof Error ? err.message : "Unable to save."));
                            }}
                            className="h-4 w-4 rounded accent-teal-500 disabled:opacity-50"
                          />
                          <span className="text-sm text-white">Use Landmines</span>
                        </label>
                        {useLandmines && (
                          <div className="mt-3 flex items-center gap-3">
                            <label className="text-xs text-slate-400 whitespace-nowrap">Landmines per team</label>
                            <select
                              disabled={!isCommissioner}
                              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white disabled:opacity-50"
                              value={landmineCount}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setLandmineCount(val);
                                if (!draftId || !setup) return;
                                void updateDraftExtras(draftId, { landmineCount: val })
                                  .then((d) => setSetup({ ...setup, draft: d }))
                                  .catch((err) => setError(err instanceof Error ? err.message : "Unable to save."));
                              }}
                            >
                              {Array.from({ length: 30 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{i + 1}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Player Rankings Type */}
                    <div className="grid gap-4 py-5 sm:grid-cols-2">
                      <div>
                        <p className="font-semibold text-white text-sm">Player Rankings Type</p>
                        <p className="mt-0.5 text-xs text-slate-500">Standard, PPR, Half-PPR, or Superflex.</p>
                      </div>
                      <div>
                        <select
                          disabled={!isCommissioner}
                          className="w-full disabled:opacity-50"
                          value={scoringType}
                          onChange={(e) => {
                            const val = e.target.value as typeof scoringType;
                            setScoringType(val);
                            if (!draftId || !setup) return;
                            void updateDraftExtras(draftId, { scoringType: val })
                              .then((d) => setSetup({ ...setup, draft: d }))
                              .catch((err) => setError(err instanceof Error ? err.message : "Unable to save."));
                          }}
                        >
                          <option value="standard">Standard</option>
                          <option value="ppr">PPR</option>
                          <option value="half_ppr">Half-PPR</option>
                          <option value="superflex">Superflex</option>
                        </select>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* TEAMS TAB */}
            {tab === "teams" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold text-white">Teams setup</p>
                    <p className="mt-0.5 text-xs text-slate-500">Add names, logos, owners, and other team details. Click a team to expand and edit.</p>
                  </div>
                  {isCommissioner && (
                    <button
                      type="button"
                      disabled={isRefreshing}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
                      onClick={refreshParticipants}
                    >
                      {isRefreshing ? "Refreshing..." : "Refresh"}
                    </button>
                  )}
                </div>

                {isCommissioner && !canManageAssignments && (
                  <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-400">
                    Pause the draft to change team assignments.
                  </div>
                )}

                {/* Accordion team list */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                  <div className="divide-y divide-slate-800">
                    {teams.map((team, index) => {
                      const owner = setup.participants.find((p) => p.teamId === team.id);
                      const pending = setup.invitations.find((inv) => inv.teamId === team.id && inv.status === "pending");
                      const isExpanded = expandedTeamId === team.id;
                      const isCommissionerTeam = owner?.role === "commissioner";
                      const isSelf = owner?.userId === setup.currentUserId;
                      const avatarColors = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#8b5cf6","#ec4899","#6366f1","#14b8a6","#f59e0b"];
                      const avatarColor = avatarColors[index % avatarColors.length];
                      const initials = team.name.trim().slice(0, 2).toUpperCase() || "T";

                      return (
                        <div key={team.id}>
                          {/* Collapsed row */}
                          <button
                            type="button"
                            className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-800/40 transition-colors"
                            onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                          >
                            <span className="w-5 shrink-0 text-sm font-bold text-slate-500 text-center">{index + 1}</span>
                            <div
                              className="h-9 w-9 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white"
                              style={{ backgroundColor: avatarColor }}
                            >
                              {team.logoUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
                                : initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white truncate">{team.name}</span>
                                {isCommissionerTeam && (
                                  <span className="shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: primary + "66", backgroundColor: primary + "15", color: primary }}>Commissioner</span>
                                )}
                                {!owner && pending && (
                                  <span className="shrink-0 rounded-md bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">Invited</span>
                                )}
                              </div>
                              {owner ? (
                                <p className="text-xs text-slate-500 truncate">{owner.displayName}{isSelf ? " (You)" : ""}</p>
                              ) : pending ? (
                                <p className="text-xs text-slate-500 truncate">{pending.email}</p>
                              ) : (
                                <p className="text-xs text-slate-600">No owner assigned</p>
                              )}
                            </div>
                            <svg className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none">
                              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>

                          {/* Expanded panel */}
                          {isExpanded && (
                            <div className="border-t border-slate-800 bg-slate-950/40 px-5 py-5">
                              <div className="grid gap-8 lg:grid-cols-[1fr_260px]">

                                {/* Left — Team identity */}
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-white">Team identity</p>
                                    <span className="text-xs text-slate-500">Core details</span>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <label className={labelCls}>Team name</label>
                                      <input type="text" disabled={!isCommissioner} className={inputCls} value={team.name} onChange={(e) => updateTeam(team.id, e.target.value)} />
                                    </div>
                                    <div>
                                      <label className={labelCls}>Short name</label>
                                      <input
                                        type="text"
                                        disabled={!isCommissioner}
                                        maxLength={10}
                                        className={inputCls}
                                        value={team.shortName ?? ""}
                                        placeholder="e.g. Rockets"
                                        onChange={(e) => updateTeamField(team.id, "shortName", e.target.value)}
                                      />
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <label className={labelCls}>Text-to-speech name <span className="normal-case font-normal text-slate-500">(Optional)</span></label>
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          disabled={!isCommissioner}
                                          maxLength={60}
                                          className={inputCls + " flex-1"}
                                          value={team.ttsName ?? ""}
                                          placeholder="Pronunciation for announcer"
                                          onChange={(e) => updateTeamField(team.id, "ttsName", e.target.value)}
                                        />
                                        <button
                                          type="button"
                                          title="Preview voice"
                                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                                          onClick={() => {
                                            if (typeof window === "undefined" || !window.speechSynthesis) return;
                                            window.speechSynthesis.cancel();
                                            const utt = new SpeechSynthesisUtterance(team.ttsName?.trim() || team.name);
                                            const voices = window.speechSynthesis.getVoices();
                                            const voice = resolveAnnouncerVoice(voices, setup?.draft.announcerVoiceUri);
                                            if (voice) utt.voice = voice;
                                            window.speechSynthesis.speak(utt);
                                          }}
                                        >
                                          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                                            <path d="M3 3.5l10 4.5-10 4.5V3.5z"/>
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                    <div>
                                      <label className={labelCls}>Autodraft</label>
                                      <label className="mt-2 flex cursor-pointer items-center gap-2.5">
                                        <input
                                          type="checkbox"
                                          disabled={!isCommissioner}
                                          checked={team.autodraft ?? false}
                                          onChange={(e) => updateTeamField(team.id, "autodraft", e.target.checked)}
                                          className="h-4 w-4 rounded accent-teal-500 disabled:opacity-40"
                                        />
                                        <span className="text-sm text-slate-300">Auto-pick when on clock</span>
                                      </label>
                                    </div>
                                  </div>

                                  <div>
                                    <label className={labelCls}>Pre-draft notes</label>
                                    <textarea
                                      disabled={!isCommissioner}
                                      rows={3}
                                      maxLength={2000}
                                      className={inputCls + " resize-y disabled:opacity-40"}
                                      value={team.preDraftNotes ?? ""}
                                      placeholder="Notes visible to the commissioner before the draft."
                                      onChange={(e) => updateTeamField(team.id, "preDraftNotes", e.target.value)}
                                    />
                                  </div>

                                  {/* Last season (collapsible) */}
                                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                                    <button
                                      type="button"
                                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                                      onClick={() => setLastSeasonOpen((prev) => {
                                        const next = new Set(prev);
                                        next.has(team.id) ? next.delete(team.id) : next.add(team.id);
                                        return next;
                                      })}
                                    >
                                      <span className="text-sm font-semibold text-white">Last season details</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs text-slate-500">Optional</span>
                                        <svg className={`h-4 w-4 text-slate-500 transition-transform ${lastSeasonOpen.has(team.id) ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none">
                                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                      </div>
                                    </button>
                                    {lastSeasonOpen.has(team.id) && (
                                      <div className="border-t border-slate-800 px-4 pb-4 pt-4">
                                        <div className="grid gap-3 sm:grid-cols-3">
                                          <div>
                                            <label className={labelCls}>First round pick</label>
                                            <input
                                              type="text"
                                              maxLength={80}
                                              disabled={!isCommissioner}
                                              className={inputCls + " disabled:opacity-40"}
                                              value={team.lastSeasonPickPlayer ?? ""}
                                              placeholder="e.g. Justin Jefferson"
                                              onChange={(e) => updateTeamField(team.id, "lastSeasonPickPlayer", e.target.value || undefined)}
                                            />
                                          </div>
                                          <div>
                                            <label className={labelCls}>Record</label>
                                            <input
                                              type="text"
                                              maxLength={20}
                                              disabled={!isCommissioner}
                                              className={inputCls + " disabled:opacity-40"}
                                              value={team.lastSeasonRecord ?? ""}
                                              placeholder="e.g. 9-4"
                                              onChange={(e) => updateTeamField(team.id, "lastSeasonRecord", e.target.value)}
                                            />
                                          </div>
                                          <div>
                                            <label className={labelCls}>Made playoffs</label>
                                            <select
                                              disabled={!isCommissioner}
                                              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
                                              value={team.lastSeasonPlayoffs === undefined ? "" : team.lastSeasonPlayoffs ? "yes" : "no"}
                                              onChange={(e) => updateTeamField(team.id, "lastSeasonPlayoffs", e.target.value === "" ? undefined : e.target.value === "yes")}
                                            >
                                              <option value="">Unknown</option>
                                              <option value="yes">Yes</option>
                                              <option value="no">No</option>
                                            </select>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Walk-up songs */}
                                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3">
                                      <div>
                                        <span className="text-sm font-semibold text-white">Team songs</span>
                                        <span className="ml-2 text-xs text-slate-500">Walk-up songs</span>
                                      </div>
                                      <span className="text-xs text-slate-500">{(Array.isArray(team.walkUpSongs) ? team.walkUpSongs : []).length} of 3 songs</span>
                                    </div>
                                    {/* Spotify connect */}
                                    <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5">
                                      {spotifyConnected ? (
                                        <div className="flex items-center gap-2">
                                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-green-400 shrink-0"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                                          <span className="text-xs text-green-400 font-medium">Spotify connected</span>
                                          <button type="button" onClick={() => {
                                              disconnectSpotify();
                                              setSpotifyConnected(false);
                                              // Remove Spotify songs from all teams
                                              setTeams((prev) => prev.map((t) => {
                                                const filtered = (Array.isArray(t.walkUpSongs) ? t.walkUpSongs : []).filter((s) => s.platform !== "spotify");
                                                if (filtered.length !== (t.walkUpSongs ?? []).length) {
                                                  void saveWalkUpSongs(t.id, filtered);
                                                  return { ...t, walkUpSongs: filtered };
                                                }
                                                return t;
                                              }));
                                            }}
                                            className="text-xs text-slate-500 hover:text-red-400 underline transition-colors ml-1">
                                            Disconnect
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col gap-0.5">
                                          <button type="button"
                                            onClick={() => initiateSpotifyPopup(() => setSpotifyConnected(true))}
                                            className="flex items-center gap-2 rounded-lg bg-[#1DB954] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#1ed760] transition-colors">
                                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                                            Connect Spotify
                                            <span className="font-normal opacity-70">(Optional)</span>
                                          </button>
                                          <span className="text-[10px] text-slate-600">Spotify Premium required · YouTube works without it</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-2">
                                      {(Array.isArray(team.walkUpSongs) ? team.walkUpSongs : []).length === 0 ? (
                                        <p className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-sm text-slate-500">
                                          No walk-up songs added yet.
                                        </p>
                                      ) : (
                                        (Array.isArray(team.walkUpSongs) ? team.walkUpSongs : []).map((song, si) => (
                                          <div key={si} className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2">
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-slate-400">
                                              <path d="M6 2v9.27A3 3 0 1 0 7 14V5h5V2H6z"/>
                                            </svg>
                                            <span className="flex-1 truncate text-sm text-slate-300">{song.title || song.url}</span>
                                            {isCommissioner && (
                                              <button
                                                type="button"
                                                className="shrink-0 text-slate-500 hover:text-red-400 transition-colors"
                                                onClick={() => {
                                                  const next = (Array.isArray(team.walkUpSongs) ? team.walkUpSongs : []).filter((_, i) => i !== si);
                                                  updateTeamField(team.id, "walkUpSongs", next);
                                                  void saveWalkUpSongs(team.id, next);
                                                }}
                                              >
                                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                                                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/>
                                                </svg>
                                              </button>
                                            )}
                                          </div>
                                        ))
                                      )}
                                      {isCommissioner && (Array.isArray(team.walkUpSongs) ? team.walkUpSongs : []).length < 3 && (
                                        <button
                                          type="button"
                                          onClick={() => setSongPickerTeamId(team.id)}
                                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:border-slate-500 hover:text-slate-300 transition-colors"
                                        >
                                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                                            <path d="M8 3v10M3 8h10" strokeLinecap="round"/>
                                          </svg>
                                          Add a song
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Right — Owner + Images + Actions */}
                                <div className="space-y-5">

                                  {/* Owner */}
                                  <div className="space-y-3">
                                    <p className="text-sm font-bold text-white">Owner</p>
                                    <div>
                                      <label className={labelCls}>Owner name</label>
                                      <input
                                        type="text"
                                        disabled={!isCommissioner}
                                        maxLength={100}
                                        className={inputCls}
                                        value={team.ownerName ?? ""}
                                        placeholder={owner ? owner.displayName : "e.g. Tyler"}
                                        onChange={(e) => updateTeamField(team.id, "ownerName", e.target.value)}
                                      />
                                    </div>
                                    {owner ? (
                                      <>
                                        <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2.5">
                                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">Joined</p>
                                          <p className="text-sm text-slate-300 truncate">{owner.displayName}</p>
                                        </div>
                                        {isCommissioner && canManageAssignments && !isCommissionerTeam && (
                                          <button type="button" className="w-full rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-400 hover:border-red-700 hover:text-red-400 transition-colors" onClick={() => void updateAssignment(owner.id, "")}>
                                            Remove owner
                                          </button>
                                        )}
                                      </>
                                    ) : pending ? (
                                      <div className="space-y-2">
                                        <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2.5">
                                          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-0.5">Invited</p>
                                          <p className="text-sm text-amber-300 truncate">{pending.email}</p>
                                        </div>
                                        <button type="button" className="text-xs text-slate-500 hover:text-slate-300 transition-colors" onClick={() => copyOwnerInvite(pending.id)}>Copy invite link</button>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {setup.participants.filter((p) => !p.teamId && p.role !== "commissioner").length > 0 && (
                                          <select aria-label="Assign existing member" className="w-full disabled:opacity-50" value="" disabled={!canManageAssignments}
                                            onChange={(e) => { const p = setup.participants.find((m) => m.id === e.target.value); if (p) void updateAssignment(p.id, team.id); }}>
                                            <option value="">Assign existing member…</option>
                                            {setup.participants.filter((p) => !p.teamId && p.role !== "commissioner").map((p) => (
                                              <option key={p.id} value={p.id}>{p.displayName}</option>
                                            ))}
                                          </select>
                                        )}
                                        {isCommissioner && (
                                          <input
                                            type="email"
                                            maxLength={320}
                                            className={inputCls}
                                            placeholder="Invite by email"
                                            value={inviteTeamId === team.id ? inviteEmail : ""}
                                            onChange={(e) => { setInviteTeamId(team.id); setInviteEmail(e.target.value); }}
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Images */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-bold text-white">Images</p>
                                      <span className="text-xs text-slate-500">4MB max</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className={labelCls}>Team logo</label>
                                        <label className="block cursor-pointer group">
                                          <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            try {
                                              const url = await uploadDraftTeamLogo(setup.draft.id, team.id, file);
                                              setSetup((prev) => prev ? { ...prev, teams: prev.teams.map((t) => t.id === team.id ? { ...t, logoUrl: url } : t) } : prev);
                                            } catch { /* ignore */ }
                                          }} />
                                          <div className="h-20 w-full rounded-xl overflow-hidden flex items-center justify-center text-xl font-bold text-white border-2 border-dashed border-slate-700 group-hover:border-slate-500 transition-colors" style={{ backgroundColor: avatarColor + "33" }}>
                                            {team.logoUrl
                                              // eslint-disable-next-line @next/next/no-img-element
                                              ? <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
                                              : initials}
                                          </div>
                                        </label>
                                      </div>
                                      <div>
                                        <label className={labelCls}>Owner photo</label>
                                        <label className="block cursor-pointer group">
                                          <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            try {
                                              const url = await uploadDraftOwnerPhoto(setup.draft.id, team.id, file);
                                              setSetup((prev) => prev ? { ...prev, teams: prev.teams.map((t) => t.id === team.id ? { ...t, ownerPhotoUrl: url } : t) } : prev);
                                            } catch { /* ignore */ }
                                          }} />
                                          <div className="h-20 w-full rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-slate-700 group-hover:border-slate-500 transition-colors bg-slate-800/40">
                                            {team.ownerPhotoUrl
                                              // eslint-disable-next-line @next/next/no-img-element
                                              ? <img src={team.ownerPhotoUrl} alt="" className="h-full w-full object-cover" />
                                              : <svg className="h-8 w-8 text-slate-600 group-hover:text-slate-400 transition-colors" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-5 0-8 2.5-8 4v1h16v-1c0-1.5-3-4-8-4z"/></svg>}
                                          </div>
                                        </label>
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500">Click either image to upload · PNG, JPG, WEBP · 4MB max</p>
                                  </div>

                                  {/* Actions */}
                                  <div className="space-y-2 pt-1">
                                    <p className="text-sm font-bold text-white">Actions</p>
                                    <button
                                      type="button"
                                      disabled={savingTeamId === team.id}
                                      className="w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
                                      style={{ backgroundColor: primary, color: secondary }}
                                      onClick={() => void saveTeam(team.id)}
                                    >
                                      {savingTeamId === team.id ? "Saving..." : "Save team"}
                                    </button>
                                    {isCommissioner && !owner && !pending && (
                                      <form onSubmit={(e) => void sendEmailInvitation(e, team.id)}>
                                        <button
                                          type="submit"
                                          data-delivery="email"
                                          disabled={isInviting || !inviteEmail || inviteTeamId !== team.id}
                                          className="w-full rounded-xl border py-2.5 text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-80"
                                          style={{ borderColor: primary + "66", color: primary }}
                                        >
                                          {isInviting && inviteTeamId === team.id ? "Sending..." : "Save team & invite owner"}
                                        </button>
                                      </form>
                                    )}
                                  </div>

                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pending invitations summary */}
                {setup.invitations.length > 0 && (
                  <div className={cardCls}>
                    <p className="text-sm font-bold text-white mb-3">Pending invitations</p>
                    <div className="space-y-1.5">
                      {setup.invitations.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
                          <span className="text-slate-300">
                            {inv.email}
                            {inv.teamId && <span className="ml-2 text-slate-600">— {teams.find((t) => t.id === inv.teamId)?.name}</span>}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="capitalize text-xs text-slate-600">{inv.status}</span>
                            {inv.status === "pending" && inv.teamId && (
                              <button type="button" className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400 hover:text-white transition-colors" onClick={() => copyOwnerInvite(inv.id)}>
                                Copy
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DRAFT ORDER TAB */}
            {tab === "draft-order" && (
              <div className="space-y-5">
                <div>
                  <p className="text-base font-bold text-white">Draft Order</p>
                  <p className="mt-0.5 text-xs text-slate-500">Set and randomize the pick order for your draft.</p>
                </div>
                <div className={cardCls}>
                  <div className="divide-y divide-slate-800">
                    {teams.map((team, index) => {
                      const avatarColors = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#8b5cf6","#ec4899","#6366f1","#14b8a6","#f59e0b"];
                      const avatarColor = avatarColors[index % avatarColors.length];
                      const initials = team.name.trim().slice(0, 2).toUpperCase() || "T";
                      return (
                        <div key={team.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                          <span className="w-6 shrink-0 text-center text-sm font-bold text-slate-500">{index + 1}</span>
                          <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: avatarColor }}>
                            {initials}
                          </div>
                          <span className="flex-1 text-sm font-medium text-white">{team.name}</span>
                          {isCommissioner && (
                            <div className="flex gap-1">
                              <button type="button" disabled={index === 0} aria-label="Move up" className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition-colors" onClick={() => moveTeam(index, -1)}>↑</button>
                              <button type="button" disabled={index === teams.length - 1} aria-label="Move down" className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition-colors" onClick={() => moveTeam(index, 1)}>↓</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {isCommissioner && (
                    <div className="mt-5 flex gap-3 border-t border-slate-800 pt-5">
                      <button
                        type="button"
                        className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        onClick={() => {
                          setTeams((prev) => [...prev].sort(() => Math.random() - 0.5));
                        }}
                      >
                        Randomize order
                      </button>
                      <button
                        type="button"
                        disabled={savingTeamId === "order"}
                        className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
                        style={{ backgroundColor: primary, color: secondary }}
                        onClick={async () => {
                          setSavingTeamId("order");
                          try { if (draftId) await updateTeamSetup(draftId, teams); }
                          catch (e) { setError(e instanceof Error ? e.message : "Unable to save order."); }
                          finally { setSavingTeamId(null); }
                        }}
                      >
                        {savingTeamId === "order" ? "Saving..." : "Save order"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AUDIO / VIDEO TAB */}
            {tab === "audio" && (
              <div className="space-y-5">

                {/* ── Announcer Voice ── */}
                <div className={cardCls}>
                  <p className="text-base font-bold text-white">Announcer Voice</p>
                  <p className="mt-0.5 text-xs text-slate-500 mb-4">Choose the text-to-speech voice used for pick announcements.</p>
                  <div className="flex items-center gap-3">
                    <select
                      disabled={!isCommissioner || availableVoices.length === 0}
                      value={getAnnouncerVoiceProfile(announcerVoiceUri)}
                      onChange={async (e) => {
                        const uri = e.target.value;
                        setAnnouncerVoiceUri(uri);
                        if (!draftId || !setup) return;
                        try {
                          const updated = await updateDraftPresentation(draftId, { announcerVoiceUri: uri });
                          setSetup({ ...setup, draft: updated });
                          flashSaved();
                        } catch (err) { setError(err instanceof Error ? err.message : "Unable to save."); }
                      }}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      <option value="drafthq:male">DraftHQ Male Announcer</option>
                      <option value="drafthq:female">DraftHQ Female Announcer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const utt = new SpeechSynthesisUtterance("With pick one, your team selects a player");
                        utt.rate = 0.85; utt.pitch = 0.95;
                        const voice = resolveAnnouncerVoice(availableVoices, announcerVoiceUri);
                        if (voice) utt.voice = voice;
                        window.speechSynthesis?.cancel();
                        window.speechSynthesis?.speak(utt);
                      }}
                      className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      Test Voice
                    </button>
                  </div>
                  {availableVoices.length === 0 && (
                    <p className="mt-2 text-xs text-slate-600">No voices found — your browser may load them after a moment.</p>
                  )}
                </div>

                {/* ── Draft Presentation ── */}
                <div className={cardCls}>
                  <p className="text-base font-bold text-white">Draft Presentation</p>
                  <p className="mt-0.5 text-xs text-slate-500 mb-4">Configure pick announcements, draft start audio, and player videos.</p>

                  <div className="space-y-5">
                    {/* Pick is in toggle + custom SFX */}
                    <div>
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={pickIsInEnabled}
                          disabled={!isCommissioner}
                          onChange={async (e) => {
                            const val = e.target.checked;
                            setPickIsInEnabled(val);
                            if (!draftId || !setup) return;
                            try {
                              const updated = await updateDraftPresentation(draftId, { pickIsInEnabled: val });
                              setSetup({ ...setup, draft: updated });
                              flashSaved();
                            } catch (err) { setError(err instanceof Error ? err.message : "Unable to save."); }
                          }}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-teal-500"
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">Use "Pick is in…" feature</p>
                          <p className="text-xs text-slate-500">Plays a sound when a player is staged for selection.</p>
                        </div>
                      </label>
                      {pickIsInEnabled && (
                        <div className="mt-3 ml-7">
                          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Pick is in sound effect</p>
                          <div className="flex items-center gap-2">
                            {isCommissioner && (
                              <label className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700 ${pickIsInUploading ? "opacity-50 pointer-events-none" : ""}`}>
                                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0">
                                  <path d="M8 11V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                                {pickIsInUploading ? "Uploading…" : "Upload custom"}
                                <input type="file" accept="audio/*" className="sr-only" disabled={!draftId || pickIsInUploading}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file || !draftId || !setup) return;
                                    setPickIsInUploading(true);
                                    try {
                                      const url = await uploadDraftPresentationAudio(draftId, "pickIsIn", file);
                                      setPickIsInSfxUrl(url);
                                      const updated = await updateDraftPresentation(draftId, { pickIsInSfxUrl: url });
                                      setSetup({ ...setup, draft: updated });
                                      flashSaved();
                                    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed."); }
                                    finally { setPickIsInUploading(false); e.target.value = ""; }
                                  }}
                                />
                              </label>
                            )}
                            {pickIsInSfxUrl ? (
                              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                                <svg viewBox="0 0 20 14" fill="none" className="h-3.5 w-3.5 shrink-0 text-teal-400">
                                  <rect x="0" y="4" width="2" height="6" rx="1" fill="currentColor"/>
                                  <rect x="3" y="1" width="2" height="12" rx="1" fill="currentColor"/>
                                  <rect x="6" y="3" width="2" height="8" rx="1" fill="currentColor"/>
                                  <rect x="9" y="0" width="2" height="14" rx="1" fill="currentColor"/>
                                  <rect x="12" y="3" width="2" height="8" rx="1" fill="currentColor"/>
                                  <rect x="15" y="1" width="2" height="12" rx="1" fill="currentColor"/>
                                  <rect x="18" y="4" width="2" height="6" rx="1" fill="currentColor"/>
                                </svg>
                                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
                                  {(() => { try { return decodeURIComponent(new URL(pickIsInSfxUrl).pathname.split("/").pop() ?? pickIsInSfxUrl); } catch { return pickIsInSfxUrl; } })()}
                                </span>
                                <button type="button" title="Preview" onClick={() => { const a = new Audio(pickIsInSfxUrl); a.play().catch(() => {}); }} className="shrink-0 text-slate-400 hover:text-white transition-colors">
                                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5"><path d="M2 2l8 4-8 4z"/></svg>
                                </button>
                                {isCommissioner && (
                                  <button type="button" title="Remove — revert to default"
                                    onClick={async () => {
                                      setPickIsInSfxUrl(null);
                                      if (!draftId || !setup) return;
                                      try {
                                        const updated = await updateDraftPresentation(draftId, { pickIsInSfxUrl: null });
                                        setSetup({ ...setup, draft: updated });
                                        flashSaved();
                                      } catch (err) { setError(err instanceof Error ? err.message : "Unable to remove."); }
                                    }}
                                    className="shrink-0 text-slate-500 hover:text-red-400 transition-colors">
                                    <svg viewBox="0 0 12 12" fill="none" className="h-3.5 w-3.5"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <p className="flex-1 text-xs text-slate-500 italic">Default sound</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-800" />

                    {/* Draft start audio */}
                    <div>
                      <p className="mb-1 text-sm font-semibold text-white">Draft start audio</p>
                      <p className="mb-2.5 text-xs text-slate-500">Sound effect played the moment the draft begins.</p>
                      <div className="flex items-center gap-2">
                        {isCommissioner && (
                          <label className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700 ${draftStartUploading ? "opacity-50 pointer-events-none" : ""}`}>
                            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0">
                              <path d="M8 11V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            {draftStartUploading ? "Uploading…" : "Upload"}
                            <input type="file" accept="audio/*" className="sr-only" disabled={!draftId || draftStartUploading}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !draftId || !setup) return;
                                setDraftStartUploading(true);
                                try {
                                  const url = await uploadDraftPresentationAudio(draftId, "draftStart", file);
                                  setDraftStartAudioUrl(url);
                                  const updated = await updateDraftPresentation(draftId, { draftStartAudioUrl: url });
                                  setSetup({ ...setup, draft: updated });
                                  flashSaved();
                                } catch (err) { setError(err instanceof Error ? err.message : "Upload failed."); }
                                finally { setDraftStartUploading(false); e.target.value = ""; }
                              }}
                            />
                          </label>
                        )}
                        {draftStartAudioUrl ? (
                          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                            <svg viewBox="0 0 20 14" fill="none" className="h-3.5 w-3.5 shrink-0 text-teal-400">
                              <rect x="0" y="4" width="2" height="6" rx="1" fill="currentColor"/>
                              <rect x="3" y="1" width="2" height="12" rx="1" fill="currentColor"/>
                              <rect x="6" y="3" width="2" height="8" rx="1" fill="currentColor"/>
                              <rect x="9" y="0" width="2" height="14" rx="1" fill="currentColor"/>
                              <rect x="12" y="3" width="2" height="8" rx="1" fill="currentColor"/>
                              <rect x="15" y="1" width="2" height="12" rx="1" fill="currentColor"/>
                              <rect x="18" y="4" width="2" height="6" rx="1" fill="currentColor"/>
                            </svg>
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
                              {(() => { try { return decodeURIComponent(new URL(draftStartAudioUrl).pathname.split("/").pop() ?? draftStartAudioUrl); } catch { return draftStartAudioUrl; } })()}
                            </span>
                            <button type="button" title="Preview" onClick={() => { const a = new Audio(draftStartAudioUrl); a.play().catch(() => {}); }} className="shrink-0 text-slate-400 hover:text-white transition-colors">
                              <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5"><path d="M2 2l8 4-8 4z"/></svg>
                            </button>
                            {isCommissioner && (
                              <button type="button" title="Remove"
                                onClick={async () => {
                                  setDraftStartAudioUrl(null);
                                  if (!draftId || !setup) return;
                                  try {
                                    const updated = await updateDraftPresentation(draftId, { draftStartAudioUrl: null });
                                    setSetup({ ...setup, draft: updated });
                                    flashSaved();
                                  } catch (err) { setError(err instanceof Error ? err.message : "Unable to remove."); }
                                }}
                                className="shrink-0 text-slate-500 hover:text-red-400 transition-colors">
                                <svg viewBox="0 0 12 12" fill="none" className="h-3.5 w-3.5"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="flex-1 text-xs text-slate-500 italic">No file — no sound on draft start</p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-800" />

                    {/* Player videos — coming soon */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">Player videos</p>
                        <p className="text-xs text-slate-500">Show a video clip when a specific player is drafted.</p>
                      </div>
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Coming soon</span>
                    </div>
                  </div>
                </div>

                {/* ── End of Round Slide ── */}
                <div className={cardCls}>
                  <p className="text-base font-bold text-white">End of round slide</p>
                  <p className="mt-0.5 text-xs text-slate-500 mb-4">Show a recap at the end of each round before the next round begins.</p>

                  <label className="flex cursor-pointer items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      checked={showRoundSlide}
                      disabled={!isCommissioner}
                      onChange={async (e) => {
                        const val = e.target.checked;
                        setShowRoundSlide(val);
                        if (!draftId || !setup) return;
                        try {
                          const updated = await updateDraftPresentation(draftId, { showRoundSlide: val });
                          setSetup({ ...setup, draft: updated });
                          flashSaved();
                        } catch (err) { setError(err instanceof Error ? err.message : "Unable to save."); }
                      }}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-teal-500"
                    />
                    <span className="text-sm font-semibold text-white">Show end of round slide</span>
                  </label>

                  {showRoundSlide && (
                    <div className="space-y-4 ml-7">
                      {/* Slide duration */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-400">Display for</span>
                        <select
                          disabled={!isCommissioner}
                          value={roundSlideSeconds}
                          onChange={async (e) => {
                            const val = Number(e.target.value);
                            setRoundSlideSeconds(val);
                            if (!draftId || !setup) return;
                            try {
                              const updated = await updateDraftPresentation(draftId, { roundSlideSeconds: val });
                              setSetup({ ...setup, draft: updated });
                              flashSaved();
                            } catch (err) { setError(err instanceof Error ? err.message : "Unable to save."); }
                          }}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                        >
                          {[3, 5, 7, 10, 15, 20, 30].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <span className="text-xs font-semibold text-slate-400">seconds</span>
                      </div>
                      {/* Pause clock */}
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={roundSlidePausesClock}
                          disabled={!isCommissioner}
                          onChange={async (e) => {
                            const val = e.target.checked;
                            setRoundSlidePausesClock(val);
                            if (!draftId || !setup) return;
                            try {
                              const updated = await updateDraftPresentation(draftId, { roundSlidePausesClock: val });
                              setSetup({ ...setup, draft: updated });
                              flashSaved();
                            } catch (err) { setError(err instanceof Error ? err.message : "Unable to save."); }
                          }}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-teal-500"
                        />
                        <div>
                          <p className="text-sm text-white">Pause clock while showing the slide</p>
                          <p className="text-xs text-slate-500">Clock pausing during round slides is coming soon.</p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                {/* Custom Sound Effects */}
                <div className={cardCls}>
                  <p className="text-base font-bold text-white">Custom Sound Effects</p>
                  <p className="mt-0.5 text-xs text-slate-500 mb-4">Audio clips played when SFX 1 / SFX 2 are clicked on the pick reveal card. Upload an MP3, WAV, or OGG (max 8 MB).</p>

                  <div className="space-y-4">
                    {([
                      { label: "SFX 1", slot: 1 as const, url: sfx1Url, setUrl: setSfx1Url },
                      { label: "SFX 2", slot: 2 as const, url: sfx2Url, setUrl: setSfx2Url },
                    ]).map(({ label, slot, url, setUrl }) => (
                      <div key={label}>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                        <div className="flex items-center gap-2">
                          {isCommissioner && (
                            <label className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700 ${sfxUploading[slot] ? "opacity-50 pointer-events-none" : ""}`}>
                              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0">
                                <path d="M8 11V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                              {sfxUploading[slot] ? "Uploading…" : "Upload"}
                              <input
                                type="file"
                                accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/x-m4a,audio/mp4,audio/aac"
                                className="sr-only"
                                disabled={!draftId || sfxUploading[slot]}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file || !draftId) return;
                                  setSfxUploading((s) => ({ ...s, [slot]: true }));
                                  try {
                                    const uploadedUrl = await uploadDraftSfx(draftId, slot, file);
                                    setUrl(uploadedUrl);
                                    const updated = await updateDraftAudio(draftId, {
                                      sfx1Url: slot === 1 ? uploadedUrl : (sfx1Url || null),
                                      sfx2Url: slot === 2 ? uploadedUrl : (sfx2Url || null),
                                    });
                                    if (setup) setSetup({ ...setup, draft: updated });
                                    flashSaved();
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : "Upload failed.");
                                  } finally {
                                    setSfxUploading((s) => ({ ...s, [slot]: false }));
                                    e.target.value = "";
                                  }
                                }}
                              />
                            </label>
                          )}

                          {url ? (
                            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                              {/* waveform icon */}
                              <svg viewBox="0 0 20 14" fill="none" className="h-3.5 w-3.5 shrink-0 text-teal-400">
                                <rect x="0" y="4" width="2" height="6" rx="1" fill="currentColor"/>
                                <rect x="3" y="1" width="2" height="12" rx="1" fill="currentColor"/>
                                <rect x="6" y="3" width="2" height="8" rx="1" fill="currentColor"/>
                                <rect x="9" y="0" width="2" height="14" rx="1" fill="currentColor"/>
                                <rect x="12" y="3" width="2" height="8" rx="1" fill="currentColor"/>
                                <rect x="15" y="1" width="2" height="12" rx="1" fill="currentColor"/>
                                <rect x="18" y="4" width="2" height="6" rx="1" fill="currentColor"/>
                              </svg>
                              <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
                                {(() => {
                                  try { return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? url); } catch { return url; }
                                })()}
                              </span>
                              <button type="button" title="Preview"
                                onClick={() => { const a = new Audio(url); a.play().catch(() => {}); }}
                                className="shrink-0 text-slate-400 hover:text-white transition-colors">
                                <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5"><path d="M2 2l8 4-8 4z"/></svg>
                              </button>
                              {isCommissioner && (
                                <button type="button" title="Remove"
                                  onClick={async () => {
                                    setUrl("");
                                    if (!draftId || !setup) return;
                                    try {
                                      const updated = await updateDraftAudio(draftId, {
                                        sfx1Url: slot === 1 ? null : (sfx1Url || null),
                                        sfx2Url: slot === 2 ? null : (sfx2Url || null),
                                      });
                                      setSetup({ ...setup, draft: updated });
                                      flashSaved();
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : "Unable to remove.");
                                    }
                                  }}
                                  className="shrink-0 text-slate-500 hover:text-red-400 transition-colors">
                                  <svg viewBox="0 0 12 12" fill="none" className="h-3.5 w-3.5">
                                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="flex-1 text-xs text-slate-600 italic">No file uploaded</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Voice Reactions */}
                <div className={cardCls}>
                  <p className="text-base font-bold text-white">Voice Reactions</p>
                  <p className="mt-0.5 text-xs text-slate-500 mb-4">TTS phrases spoken when the 😄 or 😤 buttons are clicked. One phrase is chosen at random.</p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Positive */}
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-green-500">👍 Positive</p>
                      <div className="space-y-2">
                        {posReactions.map((phrase, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              value={phrase}
                              onChange={(e) => setPosReactions((prev) => prev.map((p, idx) => idx === i ? e.target.value : p))}
                              className={inputCls}
                              disabled={!isCommissioner}
                            />
                            <button type="button" title="Preview"
                              onClick={() => { const u = new SpeechSynthesisUtterance(phrase); window.speechSynthesis?.speak(u); }}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors">
                              <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3"><path d="M2 2l8 4-8 4z"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Negative */}
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-red-500">👎 Negative</p>
                      <div className="space-y-2">
                        {negReactions.map((phrase, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              value={phrase}
                              onChange={(e) => setNegReactions((prev) => prev.map((p, idx) => idx === i ? e.target.value : p))}
                              className={inputCls}
                              disabled={!isCommissioner}
                            />
                            <button type="button" title="Preview"
                              onClick={() => { const u = new SpeechSynthesisUtterance(phrase); window.speechSynthesis?.speak(u); }}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors">
                              <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3"><path d="M2 2l8 4-8 4z"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {isCommissioner && (
                    <button type="button"
                      disabled={isSavingAudio}
                      onClick={async () => {
                        if (!draftId || !setup) return;
                        setIsSavingAudio(true);
                        try {
                          const updated = await updateDraftAudio(draftId, { posReactions, negReactions });
                          setSetup({ ...setup, draft: updated });
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Unable to save.");
                        } finally {
                          setIsSavingAudio(false);
                        }
                      }}
                      className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors">
                      {isSavingAudio ? "Saving…" : "Save Reactions"}
                    </button>
                  )}
                </div>


              </div>
            )}

            {/* CLOCK TAB */}

          </div>

          {/* ── Sidebar (desktop only, settings tab only) ── */}
          <aside className={`hidden lg:sticky lg:top-[108px] lg:self-start ${tab === "settings" ? "lg:block" : ""}`}>
            <div className={cardCls}>
              <p className="text-sm font-bold text-white">Summary</p>
              <p className="mt-0.5 text-xs text-slate-600 mb-4">Your current setup at a glance.</p>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <div>
                  <dt className="text-xs text-slate-500">Draft style</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-white">Snake</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Teams</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-white">{draft.teamCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Rounds</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-white">{draft.rounds}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Pick clock</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-white">{formatClock(draft.pickSeconds)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">On expiry</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-white">{BEHAVIOR_LABELS[draft.timerBehavior] ?? "Nothing"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Rankings</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-white">
                    {{ standard: "Standard", ppr: "PPR", half_ppr: "Half-PPR", superflex: "Superflex" }[draft.scoringType] ?? "Standard"}
                  </dd>
                </div>
                {draft.maxClockExtensions > 0 && (
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-500">Extensions</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-white">
                      {draft.maxClockExtensions} × {formatClock(draft.clockExtensionSeconds)}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Save state indicator */}
              {settingsSaveState !== "idle" && (
                <div className={`mt-4 flex items-center gap-1.5 text-xs font-semibold transition-opacity ${settingsSaveState === "saved" ? "text-emerald-400" : "text-slate-400"}`}>
                  {settingsSaveState === "saving" ? (
                    <>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Saved
                    </>
                  )}
                </div>
              )}

              {fromDraft && setup?.draft.status !== "setup" ? (
                /* Draft in progress — teams locked, settings auto-save */
                backToDraftHref && (
                  <Link
                    href={backToDraftHref}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primary, color: secondary }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                      <path d="M10.5 3L5.5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Back to Draft
                  </Link>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void saveTeams()}
                    disabled={isSaving}
                    className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primary, color: secondary }}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                  {fromDraft && backToDraftHref && (
                    <Link
                      href={backToDraftHref}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:bg-white/5"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                        <path d="M10.5 3L5.5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Back to Draft
                    </Link>
                  )}
                </>
              )}
            </div>
          </aside>

        </div>
      </div>

      {/* ── Mobile sticky save bar ── */}
      <div className={`lg:hidden fixed bottom-0 inset-x-0 z-20 border-t border-slate-800 bg-slate-950/90 backdrop-blur-sm px-4 py-3 flex items-center gap-3 ${fromDraft ? "hidden" : ""}`}>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 truncate">
            {draft.teamCount} teams · {draft.rounds} rounds · {formatClock(draft.pickSeconds)} clock
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveTeams()}
          disabled={isSaving}
          className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: primary, color: secondary }}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>

    {/* Walk-up song picker modal */}
    {songPickerTeamId && (
      <SongPicker
        onSelect={(song) => {
          const team = teams.find((t) => t.id === songPickerTeamId);
          if (team) {
            const next = [...(Array.isArray(team.walkUpSongs) ? team.walkUpSongs : []), song];
            updateTeamField(songPickerTeamId, "walkUpSongs", next);
            void saveWalkUpSongs(songPickerTeamId, next);
          }
          setSongPickerTeamId(null);
        }}
        onClose={() => setSongPickerTeamId(null)}
      />
    )}
    </>
  );
}
