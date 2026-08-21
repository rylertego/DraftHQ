"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  assignLandmines,
  revealLandmines,
  type LandminedPlayer,
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
  uploadLandmineVideo,
  listLandmineVideos,
  deleteLandmineVideo,
  type DraftSetup,
  type LandmineVideo,
} from "@/lib/draftApi";
import { formatScheduledDate, formatTimeZoneName, localTimeZone, utcToZonedWallClock, zonedWallClockToUtc } from "@/lib/draftSchedule";
import { buildOwnerInvitationMessage } from "@/lib/ownerInvitation";
import { shouldRefreshDraftOnVisibility } from "@/lib/draftRecovery";
import { moveDraftTeam } from "@/lib/teamSetupLogic";
import { supabase } from "@/lib/supabase";
import { getLeagueBranding, inviteLeagueMember } from "@/lib/leagueApi";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { AI_ANNOUNCER_PERSONAS, ELEVENLABS_VOICE_PREFIX, getAiAnnouncerId, getAnnouncerVoiceProfile, getElevenLabsVoiceId, isAiAnnouncerEnabled, resolveAnnouncerVoice } from "@/lib/speech";
import { fetchAnnouncerClipUrl, getStoredElevenLabsKey, listElevenLabsVoices, storeElevenLabsKey, type ElevenLabsVoice } from "@/lib/announcerClient";
import { MAX_WALK_UP_SONGS } from "@/lib/draftAudio";
import { DEFAULT_ROSTER_POSITIONS } from "@/lib/rosterPositions";
import ClockSettings from "@/components/ClockSettings";
import {
  CommandButton,
  CommandStatusBadge,
  commandInputClass,
  commandLabelClass,
} from "@/components/CommandCenterUI";
import { Button, Field, Input, Panel, Select, StatusBadge } from "@/components/ui";
import DraftOrderRace from "@/components/DraftOrderRace";
import SongPicker from "@/components/SongPicker";
import ResetDraftModal from "@/components/ResetDraftModal";
import { initiateSpotifyPopup, isSpotifyConnected, disconnectSpotify, consumeSpotifyCallback } from "@/lib/spotifyAuth";
import type { DraftInvitation, RosterPosition, Team, TimerBehavior, WalkUpSong } from "@/types/draft";

const ROSTER_POSITIONS_COLLAPSED = 7;

type Tab = "settings" | "teams" | "audio";

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

function DraftMetric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "ready" | "warning" | "complete";
}) {
  const toneClass = {
    neutral: "text-white",
    ready: "text-blue-100",
    warning: "text-amber-100",
    complete: "text-emerald-100",
  }[tone];

  return (
    <div className="min-w-0 rounded-xl bg-slate-950/35 px-4 py-3 ring-1 ring-white/10">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-xl font-black tabular-nums ${toneClass}`}>{value}</p>
      {detail && <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

export default function TeamSetupForm({ draftId }: TeamSetupFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  // "draft-order" merged into the Teams tab; old links land there.
  const initialTab: Tab = rawTab === "settings" || rawTab === "audio" ? rawTab : "teams";
  const leagueSlug = searchParams.get("leagueSlug");
  const fromDraft = searchParams.get("fromDraft") === "1";
  const backHref = leagueSlug ? `/leagues/${leagueSlug}` : "/dashboard";
  const backToDraftHref = draftId
    ? `/draft/lobby?draftId=${draftId}${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`
    : null;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [orderDirty, setOrderDirty] = useState(false);
  const [showOrderRace, setShowOrderRace] = useState(false);
  const [setup, setSetup] = useState<DraftSetup | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
    const connected = consumeSpotifyCallback() || isSpotifyConnected();
    const timer = window.setTimeout(() => setSpotifyConnected(connected), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const [rounds, setRounds] = useState(15);
  const [isSavingRounds, setIsSavingRounds] = useState(false);
  const [teamCount, setTeamCount] = useState(10);
  const [isSavingTeamCount, setIsSavingTeamCount] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  // Defaults to this machine's zone and is then whatever the draft was saved
  // with. There is no picker: see the Draft Date panel.
  const [scheduledTimezone, setScheduledTimezone] = useState(localTimeZone);
  // Held separately so the panel can say "this draft is set in Eastern, you are
  // in Pacific" instead of quietly showing a time that means something else.
  const [viewerTimeZone] = useState(localTimeZone);
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
  // Walk-up music mode
  const [walkUpMusicMode, setWalkUpMusicMode] = useState<"restart" | "resume">("restart");
  // Awards ceremony music
  const [awardsSong, setAwardsSong] = useState<WalkUpSong | null>(null);
  const [showAwardsSongPicker, setShowAwardsSongPicker] = useState(false);
  // Announcer voice
  const [announcerVoiceUri, setAnnouncerVoiceUri] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  // Landmine videos
  const [landmineVideos, setLandmineVideos] = useState<LandmineVideo[]>([]);
  const [uploadingLandmineVideo, setUploadingLandmineVideo] = useState(false);
  // ElevenLabs bring-your-own account (key lives in this browser only)
  const [elConnected, setElConnected] = useState(() => !!getStoredElevenLabsKey());
  const [elKeyInput, setElKeyInput] = useState("");
  const [elVoices, setElVoices] = useState<ElevenLabsVoice[]>([]);
  const [elBusy, setElBusy] = useState(false);
  const [elError, setElError] = useState("");
  const [settingsSaveState, setSettingsSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [error, setError] = useState("");

  const { accentColor: primary, bgColor: secondary, setAccentColor, setBgColor } = useLeagueTheme();

  // The league's own team count, so Draft Settings can show where the number
  // comes from instead of offering a second place to set it. Null for a
  // standalone draft, which has no league to inherit from.
  const [leagueTeamCount, setLeagueTeamCount] = useState<number | null>(null);

  useEffect(() => {
    if (!leagueSlug) return;
    void getLeagueBranding(leagueSlug).then((b) => {
      if (b?.primaryColor) setAccentColor(b.primaryColor);
      if (b?.secondaryColor) setBgColor(b.secondaryColor);
      setLeagueTeamCount(b?.teamCount ?? null);
    });
  }, [leagueSlug, setAccentColor, setBgColor]);

  // Load the landmine video pool
  useEffect(() => {
    if (!draftId) return;
    void listLandmineVideos(draftId).then(setLandmineVideos).catch(() => {});
  }, [draftId]);

  // Load the voice library when this browser already has a stored key.
  useEffect(() => {
    if (!isAiAnnouncerEnabled()) return;
    const key = getStoredElevenLabsKey();
    if (!key) return;
    void listElevenLabsVoices(key).then((voices) => {
      if (voices) setElVoices(voices);
    });
  }, []);

  useEffect(() => {
    if (!draftId) { router.replace("/create"); return; }

    let cancelled = false;
    void getDraftSetup(draftId).then((s) => {
      if (!cancelled) {
        setSetup(s); setTeams(s.teams); setDraftName(s.draft.name);
        setRounds(s.draft.rounds); setTeamCount(s.draft.teamCount);
        // Read back in the draft's own zone. Slicing the ISO string showed UTC,
        // so a draft saved for 7:00 PM Eastern reloaded as 23:00.
        const zone = s.draft.scheduledTimezone || localTimeZone();
        if (s.draft.scheduledTimezone) setScheduledTimezone(s.draft.scheduledTimezone);
        if (s.draft.scheduledAt) {
          const wall = utcToZonedWallClock(s.draft.scheduledAt, zone);
          setScheduledDate(wall.date);
          setScheduledTime(wall.time);
        }
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
        setWalkUpMusicMode(s.draft.walkUpMusicMode ?? "restart");
        setAwardsSong(s.draft.awardsSong ?? null);
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
    setOrderDirty(true);
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
    try {
      const updated = await assignTeam(draftId, participantId, teamId || null);
      setSetup({ ...setup, participants: setup.participants.map((p) => p.id === participantId ? updated : p) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to assign team.");
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
      await updateTeamDetails(draftId, teamId, { walkUpSongs: songs.slice(0, MAX_WALK_UP_SONGS) });
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
      if (setup?.draft.status === "setup") {
        await updateTeamSetup(draftId, teams);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Unable to save teams.");
    } finally {
      setIsSaving(false);
    }
  }

  async function continueToDraft() {
    if (!draftId) return;
    if (setup?.draft.status === "setup" && teams.some((t) => !t.name.trim())) {
      setError("Every team must have a name."); return;
    }
    setError(""); setIsSaving(true);
    try {
      if (setup?.draft.status === "setup") {
        await updateTeamSetup(draftId, teams);
      }
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
  // Both halves matter. assign_team() is commissioner-gated, so without the
  // isCommissioner test a non-commissioner saw an enabled dropdown and got
  // "Unable to assign team" on selecting anyone — the control offered something
  // the database was always going to refuse.
  const canManageAssignments =
    isCommissioner && (setup.draft.status === "setup" || setup.draft.status === "paused");
  const draft = setup.draft;
  // Keyed off the draft's own league_id rather than the leagueSlug query param,
  // which is caller-supplied and absent on some entry paths.
  const isLeagueDraft = Boolean(draft.leagueId);
  // A league draft is seeded from the league's count at creation, so these
  // agree unless someone changed League Settings afterwards. Surfaced rather
  // than silently resized: shrinking the draft deletes team rows, names and
  // logos included, which is not something to do behind the commissioner's back
  // on page load.
  const teamCountDiffersFromLeague =
    isLeagueDraft && leagueTeamCount !== null && leagueTeamCount !== draft.teamCount;
  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join/${draft.joinCode}`
    : `/join/${draft.joinCode}`;
  const isDraftNameDirty = draftName.trim() !== draft.name && draftName.trim() !== "";
  const namedTeams = teams.filter((team) => team.name.trim()).length;
  const assignedTeams = teams.filter((team) =>
    setup.participants.some((participant) => participant.teamId === team.id)
  ).length;
  const enabledRosterSlots = rosterPositions
    .filter((position) => position.enabled)
    .reduce((total, position) => total + position.max, 0);
  const readinessIssues = [
    draftName.trim() ? null : "Name the draft",
    teams.length === draft.teamCount ? null : `Align team slots to ${draft.teamCount}`,
    namedTeams === teams.length ? null : "Name every team",
    scheduledDate ? null : "Schedule the draft",
    enabledRosterSlots > 0 ? null : "Enable roster slots",
  ].filter(Boolean) as string[];
  const primaryActionLabel =
    fromDraft && backToDraftHref
      ? "Back to Draft"
      : readinessIssues.includes("Schedule the draft")
        ? "Schedule Draft"
        : readinessIssues.includes("Name every team")
          ? "Review Teams"
          : "Enter Draft Room";
  function handlePrimaryAction() {
    if (fromDraft && backToDraftHref) {
      router.push(backToDraftHref);
      return;
    }
    if (readinessIssues.includes("Schedule the draft")) {
      setTab("settings");
      requestAnimationFrame(() => {
        document.getElementById("draft-date-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    if (readinessIssues.includes("Name every team")) {
      setTab("teams");
      return;
    }
    void continueToDraft();
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "settings", label: "General" },
    { id: "teams", label: "Teams & Order" },
    { id: "audio", label: "Audio & Presentation" },
  ];

  const inputCls = commandInputClass;
  const labelCls = commandLabelClass;
  const cardCls = "rounded-xl border border-slate-800/90 bg-slate-900/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]";

  return (
    <>
    <div className="flex-1 text-white">

      {/* ── Header ── */}
      <header className="hidden">
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
                {draft.status === "active" && (
                  <span className="rounded-md border border-[color-mix(in_srgb,var(--color-league-accent-border)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-league-accent)_10%,transparent)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-league-accent)]">
                    ● Live
                  </span>
                )}
                {draft.status === "paused" && (
                  <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
                    ⏸ Paused
                  </span>
                )}
                {draft.status === "complete" && (
                  <span className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Complete
                  </span>
                )}
                {draft.status === "setup" && (
                  <span className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Pre-Draft
                  </span>
                )}
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

      {/* Sticky toolbar. Draft settings is a long page and the way back out
          should never require scrolling to the top to find.

          This must be a direct child of the page root, not of the max-w-7xl
          content wrapper. A sticky element only stays pinned within its own
          parent's box, and that wrapper is ~450px tall on a ~2600px page, so
          the button unpinned almost immediately. The root spans the full
          scroll, so the backdrop goes full-bleed here and the inner div
          restores the content width.

          The offset stacks it under the global AccountNav header, which is
          itself `sticky top-0 z-40`. At top-0 this bar pins correctly but sits
          hidden behind that header.

          This was a hardcoded top-[113px], measured once. That coupling broke
          the moment AccountNav's logo became responsive and its height started
          varying by breakpoint. AccountNav now measures itself and publishes
          --layout-header-height, so this follows whatever the header actually
          is. */}
      <div className="sticky top-[var(--layout-header-height)] z-30 border-b border-[color:var(--color-border-subtle)] bg-[var(--color-canvas)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href={backHref}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-800/90 bg-slate-900/60 px-3 text-sm font-bold text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M10.5 3L5.5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            League Command
          </Link>
          {isCommissioner && leagueSlug && (
            // Same outline treatment as the Reset Draft trigger in the league
            // command center. This was a solid red block, so the identical
            // action looked different depending on which screen you opened it
            // from — and the loud version overstates a control nobody should be
            // drawn toward. The confirmation dialog it opens is where the
            // emphasis belongs.
            <button
              type="button"
              onClick={() => setShowResetDraft(true)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[color:var(--color-danger)]/30 px-4 text-xs font-bold text-[color:var(--color-danger-border)] transition-colors hover:border-[color:var(--color-danger)]/50 hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]"
            >
              Reset Draft
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">

        <section className="overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/72 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="relative grid gap-6 px-6 py-6 lg:grid-cols-[1fr_360px] lg:items-center">
            <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: primary }} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: primary }}>Draft Command Center</p>
                {/* No readiness percentage. It was removed from the league
                    dashboard for saying nothing actionable, and two surfaces
                    disagreeing about that is worse than either choice. The
                    "next setup requirement" line below states what to do.
                    Read Only stays: it is an exception, not a status. */}
                {!isCommissioner && <CommandStatusBadge label="Read Only" tone="neutral" />}
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{draft.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Configure the draft format, order, timing, and broadcast presentation from one commissioner workspace.
              </p>
              {readinessIssues.length > 0 && (
                <p className="mt-3 text-sm leading-6 text-amber-200">
                  Next setup requirement: <span className="font-bold">{readinessIssues[0]}</span>
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <CommandButton
                  type="button"
                  variant="primary"
                  onClick={handlePrimaryAction}
                  disabled={isSaving}
                  style={{ backgroundColor: primary, color: secondary }}
                >
                  {isSaving ? "Saving..." : primaryActionLabel}
                </CommandButton>
                {fromDraft && backToDraftHref && (
                  <Link
                    href={backToDraftHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/60 px-5 py-3 text-sm font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                  >
                    Back to Draft
                  </Link>
                )}
              </div>
            </div>

            {/* The four metric tiles that sat here are gone. Teams, Rounds and
                Pick Clock were already in the Draft Setup Summary on the same
                screen — the hero repeated three of six sidebar rows, and the
                tile's "Nothing happens" detail restated the summary's "On
                expiry". Draft Date was the only fact unique to the hero, so it
                moved into the summary rather than being dropped.

                The hero now does what the league command center's does: name
                the thing and offer the primary action. */}
          </div>

          {/* Plain underline tabs, matching League Settings. These were boxed
              cards carrying a second uppercase label — Format / Order /
              Broadcast — under each name. Two labels per tab restated the same
              thing, and the boxes read as three buttons rather than one
              selector, which is why this screen felt unlike the rest of the
              app. */}
          <div className="border-t border-[color:var(--color-border-subtle)] px-5">
            <nav className="flex gap-6" role="tablist" aria-label="Draft settings sections">
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.id)}
                    className={`group relative py-4 text-sm font-black transition-colors focus-visible:outline-none ${
                      active
                        ? "text-[color:var(--color-text-primary)]"
                        : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)]"
                    }`}
                  >
                    {t.label}
                    <span
                      className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full transition-opacity ${
                        active
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-40 group-focus-visible:opacity-100"
                      }`}
                      style={{ backgroundColor: primary }}
                    />
                  </button>
                );
              })}
            </nav>
          </div>
        </section>
      </div>

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
      <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
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
          <div className="min-w-0">

            {/* SETTINGS TAB */}
            {tab === "settings" && (
              <div className="space-y-5">

                <Panel
                  title="Draft Details"
                  description="Name the draft and share the owner join link before draft night."
                >

                  <div className="grid gap-[var(--space-5)] sm:grid-cols-2">
                    <Field label="Draft name" controlId="draft-name">
                      <div className="flex gap-[var(--space-2)]">
                        <Input
                          id="draft-name"
                          ref={nameInputRef}
                          type="text"
                          maxLength={80}
                          disabled={!isCommissioner || isSavingName}
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onBlur={() => { if (isDraftNameDirty) void saveDraftName(); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void saveDraftName(); nameInputRef.current?.blur(); } }}
                        />
                        {/* Blur already saves; this button exists for the mouse
                            user who wants to see the save happen. It stays
                            accent-tinted rather than using Button's primary,
                            because it is a save affordance inside a field, not
                            the panel's action. */}
                        {isDraftNameDirty && (
                          <button
                            type="button"
                            disabled={isSavingName}
                            onClick={() => void saveDraftName()}
                            className="shrink-0 rounded-[var(--radius-control)] px-[var(--space-3)] text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: primary, color: secondary }}
                          >
                            {isSavingName ? "..." : "Save"}
                          </button>
                        )}
                      </div>
                    </Field>

                    <Field label="Join code" controlId="draft-join-code">
                      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                        <span
                          id="draft-join-code"
                          className="max-w-full rounded-[var(--radius-control)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] px-[var(--space-3)] py-[var(--space-2)] font-mono text-sm font-bold tracking-[0.18em] text-[color:var(--color-text-primary)] sm:text-lg sm:tracking-[0.25em]"
                        >
                          {draft.joinCode}
                        </span>
                        <Button variant="secondary" onClick={copyJoinLink}>
                          Copy link
                        </Button>
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
                    </Field>
                  </div>
                </Panel>

                <Panel
                  title="Draft Format"
                  description="Set the number of rounds and the rankings profile players are drafted against."
                >

                  <div className="mb-[var(--space-5)] grid gap-[var(--space-5)] sm:grid-cols-3">
                    {/* Read-only for a league draft. The league is the one place
                        that answers "how many teams are we", and a second
                        control here let a commissioner set a draft to 10 while
                        the league said 12 — with no indication which was real.
                        A standalone draft has no league to inherit from, so it
                        keeps the control. */}
                    <Field
                      label="Teams"
                      controlId="draft-team-count"
                      description={isLeagueDraft ? "Set in League Settings." : undefined}
                    >
                      {isLeagueDraft ? (
                        <>
                          <div className="flex min-h-11 items-center gap-[var(--space-2)]">
                            <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                              {teamCount} teams
                            </span>
                            {leagueSlug && isCommissioner && (
                              <Link
                                href={`/leagues/${leagueSlug}/settings`}
                                className="text-xs transition-opacity hover:opacity-80"
                                style={{ color: primary }}
                              >
                                Change ↗
                              </Link>
                            )}
                          </div>
                          {teamCountDiffersFromLeague && (
                            <p className="mt-[var(--space-1)] text-xs text-[color:var(--color-warning-text)]">
                              League Settings says {leagueTeamCount} teams. This draft was created
                              with {teamCount} and keeps that until you rebuild it.
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-[var(--space-2)]">
                          <Select
                            disabled={!isCommissioner || isSavingTeamCount}
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
                          </Select>
                          {isSavingTeamCount && <span className="shrink-0 text-xs text-[color:var(--color-text-muted)]">Saving...</span>}
                        </div>
                      )}
                    </Field>
                    <Field label="Rounds" controlId="draft-rounds">
                      <div className="flex items-center gap-[var(--space-2)]">
                        <Select
                          disabled={!isCommissioner || isSavingRounds}
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
                        </Select>
                        {isSavingRounds && <span className="shrink-0 text-xs text-[color:var(--color-text-muted)]">Saving...</span>}
                      </div>
                    </Field>
                    <Field label="Player Rankings" controlId="draft-scoring-type">
                      <Select
                        disabled={!isCommissioner}
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
                      </Select>
                    </Field>
                  </div>
                </Panel>

                <Panel
                  title="Draft Style"
                  description="How picks are made. Only regular snake drafts are supported today."
                  actions={fromDraft ? <StatusBadge>Locked during draft</StatusBadge> : undefined}
                >
                  <div>
                    <div className={`space-y-2 ${fromDraft ? "pointer-events-none opacity-50" : ""}`}>
                      {/* Regular / Snake — active */}
                      <div className="flex items-start gap-3 rounded-xl border px-4 py-3" style={{ borderColor: primary + "55", backgroundColor: primary + "15" }}>
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: primary }}>
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: primary }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Regular</p>
                          <p className="text-xs text-[color:var(--color-text-muted)]">Teams take turns selecting players (snake/serpentine order).</p>
                        </div>
                      </div>
                      {/* Auction — coming soon */}
                      <div className="flex cursor-not-allowed items-start gap-[var(--space-3)] rounded-[var(--radius-control)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] px-[var(--space-4)] py-[var(--space-3)] opacity-50">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--color-border-strong)]" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[color:var(--color-text-secondary)]">Auction</p>
                            <StatusBadge>Coming soon</StatusBadge>
                          </div>
                          <p className="text-xs text-[color:var(--color-text-muted)]">Teams bid on players during nominations.</p>
                        </div>
                      </div>
                      {/* Combo — coming soon */}
                      <div className="flex cursor-not-allowed items-start gap-[var(--space-3)] rounded-[var(--radius-control)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] px-[var(--space-4)] py-[var(--space-3)] opacity-50">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--color-border-strong)]" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[color:var(--color-text-secondary)]">Combo / Half-and-Half</p>
                            <StatusBadge>Coming soon</StatusBadge>
                          </div>
                          <p className="text-xs text-[color:var(--color-text-muted)]">Auction rounds followed by regular snake rounds.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="Pick Clock"
                  description="How long each team has to pick, how many extensions they get, and what happens when the clock runs out."
                >
                  <div>
                    <ClockSettings
                      draft={draft}
                      disabled={isSavingClock}
                      onSave={(s) => void saveClockSettings(s)}
                    />
                    {isSavingClock && <p className="mt-[var(--space-2)] text-xs text-[color:var(--color-text-muted)]">Saving...</p>}
                  </div>
                </Panel>

                {/* The hover "?" that used to sit beside this heading said
                    exactly what the description says, so it was a tooltip no
                    one needed to open. */}
                <Panel
                  id="draft-date-section"
                  title="Draft Date"
                  description="Optional — set a date and time to share with owners."
                >
                  <div className="scroll-mt-6">
                    <div className="grid gap-[var(--space-4)] sm:grid-cols-3">
                      <Field label="Date" controlId="draft-scheduled-date">
                        <Input
                          type="date"
                          disabled={!isCommissioner || isSavingSchedule}
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          onBlur={() => {
                            if (!draftId || !setup || !scheduledDate) return;
                            setIsSavingSchedule(true);
                            const iso = zonedWallClockToUtc(scheduledDate, scheduledTime, scheduledTimezone);
                            updateDraftSchedule(draftId, iso, scheduledTimezone)
                              .then((updated) => setSetup({ ...setup, draft: updated }))
                              .catch((e) => setError(e instanceof Error ? e.message : "Unable to save schedule."))
                              .finally(() => setIsSavingSchedule(false));
                          }}
                        />
                      </Field>
                      <Field label="Time" controlId="draft-scheduled-time">
                        <Input
                          type="time"
                          disabled={!isCommissioner || isSavingSchedule || !scheduledDate}
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          onBlur={() => {
                            if (!draftId || !setup || !scheduledDate) return;
                            setIsSavingSchedule(true);
                            const iso = zonedWallClockToUtc(scheduledDate, scheduledTime, scheduledTimezone);
                            updateDraftSchedule(draftId, iso, scheduledTimezone)
                              .then((updated) => setSetup({ ...setup, draft: updated }))
                              .catch((e) => setError(e instanceof Error ? e.message : "Unable to save time."))
                              .finally(() => setIsSavingSchedule(false));
                          }}
                        />
                      </Field>
                      {/* Not a control any more. The zone is whatever the
                          commissioner's machine reports when the draft is first
                          scheduled, and the stored zone thereafter — so editing
                          the time later from a different machine still means the
                          same wall clock in the zone the draft was set in,
                          rather than silently re-anchoring the instant.

                          The ten-entry dropdown that used to live here could
                          only ever be wrong for anyone outside those ten zones,
                          and made every commissioner confirm a fact the browser
                          already knew. */}
                      <Field label="Timezone" controlId="draft-scheduled-timezone">
                        <div className="flex min-h-11 flex-col justify-center">
                          <span
                            id="draft-scheduled-timezone"
                            className="text-sm font-semibold text-[color:var(--color-text-primary)]"
                          >
                            {formatTimeZoneName(scheduledTimezone)}
                          </span>
                          <span className="text-xs text-[color:var(--color-text-muted)]">
                            {scheduledTimezone === viewerTimeZone
                              ? "Your timezone"
                              : `Detected ${formatTimeZoneName(viewerTimeZone)} — set when this draft was scheduled`}
                          </span>
                        </div>
                      </Field>
                    </div>
                    {scheduledDate && (
                      <button
                        type="button"
                        className="mt-[var(--space-2)] text-xs text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-danger-text)]"
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
                    {isSavingSchedule && <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">Saving...</p>}
                  </div>
                </Panel>

                {/* ── Roster Positions ── */}
                <Panel
                  title="Roster Positions"
                  description="Choose which positions exist and how many players can be rostered at each slot."
                >

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
                                className="h-4 w-4 rounded accent-[var(--color-league-accent)]"
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
                </Panel>

                {/* ── Visibility & extras ── */}
                <Panel
                  title="Visibility & Extras"
                  description="Optional controls that affect what owners see and how special draft-night moments behave."
                >

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
                              const checked = e.target.checked;
                              setUseLandmines(checked);
                              if (!draftId || !setup) return;
                              void updateDraftExtras(draftId, { useLandmines: checked })
                                .then((d) => {
                                  setSetup({ ...setup, draft: d });
                                  if (checked) return assignLandmines(draftId);
                                })
                                .catch((err) => setError(err instanceof Error ? err.message : "Unable to save."));
                            }}
                            className="h-4 w-4 rounded accent-[var(--color-league-accent)] disabled:opacity-50"
                          />
                          <span className="text-sm text-white">Use Landmines</span>
                        </label>
                        {useLandmines && (
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center gap-3">
                              <label className="text-xs text-slate-400 whitespace-nowrap">Number of landmines</label>
                              <select
                                disabled={!isCommissioner}
                                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white disabled:opacity-50"
                                value={landmineCount}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setLandmineCount(val);
                                  if (!draftId || !setup) return;
                                  void updateDraftExtras(draftId, { landmineCount: val })
                                    .then((d) => {
                                      setSetup({ ...setup, draft: d });
                                      if (useLandmines) return assignLandmines(draftId);
                                    })
                                    .catch((err) => setError(err instanceof Error ? err.message : "Unable to save."));
                                }}
                              >
                                {Array.from({ length: 30 }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                                ))}
                              </select>
                              {isCommissioner && draftId && (
                                <LandmineRevealButton draftId={draftId} />
                              )}
                            </div>

                            {/* Landmine videos — optional replacement for the bomb animation */}
                            <div className="border-t border-slate-800 pt-3">
                              <p className="text-xs font-semibold text-slate-300">Landmine videos <span className="font-normal text-slate-500">(optional)</span></p>
                              <p className="mb-2 mt-0.5 text-[11px] leading-snug text-slate-500">
                                Full-screen videos played when a landmine hits, instead of the built-in bomb.
                                Videos cycle through the pool so everyone sees the same clip. MP4/WebM, max 25 MB, up to 6.
                              </p>
                              <div className="space-y-1.5">
                                {landmineVideos.map((video) => (
                                  <div key={video.name} className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-1.5">
                                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-red-400">
                                      <rect x="1" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                                      <path d="M11 7l4-2.5v7L11 9" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                                    </svg>
                                    <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{video.name}</span>
                                    <a href={video.url} target="_blank" rel="noreferrer" title="Preview"
                                      className="shrink-0 text-slate-400 transition-colors hover:text-white">
                                      <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3"><path d="M2 2l8 4-8 4z"/></svg>
                                    </a>
                                    {isCommissioner && (
                                      <button type="button" title="Remove"
                                        className="shrink-0 text-slate-500 transition-colors hover:text-red-400"
                                        onClick={async () => {
                                          if (!draftId) return;
                                          try {
                                            await deleteLandmineVideo(draftId, video.name);
                                            setLandmineVideos((prev) => prev.filter((v) => v.name !== video.name));
                                            flashSaved();
                                          } catch (err) {
                                            setError(err instanceof Error ? err.message : "Unable to remove video.");
                                          }
                                        }}>
                                        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                                          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                ))}
                                {isCommissioner && landmineVideos.length < 6 && (
                                  <label className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:border-slate-500 hover:text-slate-300 ${uploadingLandmineVideo ? "pointer-events-none opacity-50" : ""}`}>
                                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3">
                                      <path d="M8 3v10M3 8h10" strokeLinecap="round"/>
                                    </svg>
                                    {uploadingLandmineVideo ? "Uploading…" : "Add a video"}
                                    <input
                                      type="file"
                                      accept="video/mp4,video/webm"
                                      className="sr-only"
                                      disabled={!draftId || uploadingLandmineVideo}
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file || !draftId) return;
                                        if (file.size > 25 * 1024 * 1024) {
                                          setError("Landmine videos must be 25 MB or smaller.");
                                          e.target.value = "";
                                          return;
                                        }
                                        setUploadingLandmineVideo(true);
                                        try {
                                          await uploadLandmineVideo(draftId, file);
                                          setLandmineVideos(await listLandmineVideos(draftId));
                                          flashSaved();
                                        } catch (err) {
                                          setError(err instanceof Error ? err.message : "Upload failed.");
                                        } finally {
                                          setUploadingLandmineVideo(false);
                                          e.target.value = "";
                                        }
                                      }}
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </Panel>

              </div>
            )}

            {/* TEAMS TAB */}
            {tab === "teams" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-800/90 bg-slate-900/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Operational Control</p>
                    <h2 className="mt-1 text-base font-bold text-white">Teams & Draft Order</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Assign owners, tune team details, and maintain the live draft order from one compact command list.</p>
                  </div>
                  {isCommissioner && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isRefreshing}
                        className="min-h-10 rounded-xl border border-slate-700/80 bg-slate-950/40 px-3 text-xs font-bold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:opacity-50"
                        onClick={refreshParticipants}
                      >
                        {isRefreshing ? "Refreshing..." : "Refresh"}
                      </button>
                      <button
                        type="button"
                        className="min-h-10 rounded-xl border border-slate-700/80 bg-slate-950/40 px-3 text-xs font-bold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800"
                        onClick={() => {
                          setTeams((prev) => [...prev].sort(() => Math.random() - 0.5));
                          setOrderDirty(true);
                        }}
                      >
                        Randomize order
                      </button>
                      <button
                        type="button"
                        className="min-h-10 rounded-xl border px-3 text-xs font-bold transition-colors hover:bg-slate-800"
                        style={{ borderColor: primary + "66", color: primary }}
                        onClick={() => setShowOrderRace(true)}
                      >
                        Draft order race
                      </button>
                      <button
                        type="button"
                        disabled={!orderDirty || savingTeamId === "order"}
                        className="min-h-10 rounded-xl px-4 text-xs font-black disabled:opacity-40 transition-opacity hover:opacity-90"
                        style={{ backgroundColor: primary, color: secondary }}
                        onClick={async () => {
                          setSavingTeamId("order");
                          try {
                            if (draftId) await updateTeamSetup(draftId, teams);
                            setOrderDirty(false);
                          }
                          catch (e) { setError(e instanceof Error ? e.message : "Unable to save order."); }
                          finally { setSavingTeamId(null); }
                        }}
                      >
                        {savingTeamId === "order" ? "Saving..." : orderDirty ? "Save order" : "Order saved"}
                      </button>
                    </div>
                  )}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <DraftMetric label="Assigned" value={`${assignedTeams}/${teams.length}`} detail="Owner seats" tone={assignedTeams === teams.length ? "complete" : "warning"} />
                    <DraftMetric label="Order" value={orderDirty ? "Unsaved" : "Saved"} detail="Manual order" tone={orderDirty ? "warning" : "complete"} />
                    <DraftMetric label="Locked State" value={canManageAssignments ? "Editable" : "Locked"} detail={canManageAssignments ? "Setup controls on" : "Pause to edit"} tone={canManageAssignments ? "complete" : "warning"} />
                  </div>
                </div>

                {isCommissioner && !canManageAssignments && (
                  <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-400">
                    Pause the draft to change team assignments.
                  </div>
                )}

                {/* Accordion team list */}
                <div className="overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/72 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                  <div className="divide-y divide-slate-800">
                    {teams.map((team, index) => {
                      const owner = setup.participants.find((p) => p.teamId === team.id);
                      const pending = setup.invitations.find((inv) => inv.teamId === team.id && inv.status === "pending");
                      const isExpanded = expandedTeamId === team.id;
                      const isCommissionerTeam = owner?.role === "commissioner";
                      const isSelf = owner?.userId === setup.currentUserId;
                      // Team ownership for a draft lives in draft_participants,
                      // not on teams. public.teams has no owner_user_id column —
                      // that field exists on league_teams. See the note in
                      // docs/STATUS.md: update_team_details() reads
                      // v_team.owner_user_id and plpgsql only resolves that at
                      // runtime, so its owner branch is believed broken.
                      const canEditTeam = isCommissioner || isSelf;
                      const avatarColors = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#8b5cf6","#ec4899","#6366f1","var(--color-league-accent)","#f59e0b"];
                      const avatarColor = avatarColors[index % avatarColors.length];
                      const initials = team.name.trim().slice(0, 2).toUpperCase() || "T";

                      return (
                        <div key={team.id}>
                          {/* Collapsed row — div[role=button] so the reorder arrows can be real buttons inside */}
                          <div
                            role="button"
                            tabIndex={0}
                            className="w-full flex cursor-pointer items-center gap-4 px-5 py-4 text-left hover:bg-slate-800/40 transition-colors"
                            onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setExpandedTeamId(isExpanded ? null : team.id);
                              }
                            }}
                          >
                            <span className="w-5 shrink-0 text-sm font-bold text-slate-500 text-center">{index + 1}</span>
                            {team.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={team.logoUrl} alt="" className="h-14 w-14 shrink-0 object-contain" />
                            ) : (
                              <div
                                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                                style={{ backgroundColor: avatarColor }}
                              >
                                {initials}
                              </div>
                            )}
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
                            {/* Draft-order arrows (merged from the old Draft Order tab) */}
                            {isCommissioner && (
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  aria-label={`Move ${team.name} up in the draft order`}
                                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); moveTeam(index, -1); }}
                                >↑</button>
                                <button
                                  type="button"
                                  disabled={index === teams.length - 1}
                                  aria-label={`Move ${team.name} down in the draft order`}
                                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); moveTeam(index, 1); }}
                                >↓</button>
                              </div>
                            )}
                            <svg className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none">
                              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>

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
                                          className="h-4 w-4 rounded accent-[var(--color-league-accent)] disabled:opacity-40"
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
                                        if (next.has(team.id)) next.delete(team.id);
                                        else next.add(team.id);
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
                                      <span className="text-xs text-slate-500">{(Array.isArray(team.walkUpSongs) ? team.walkUpSongs : []).length} of {MAX_WALK_UP_SONGS} songs</span>
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
                                      {isCommissioner && (Array.isArray(team.walkUpSongs) ? team.walkUpSongs : []).length < MAX_WALK_UP_SONGS && (
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
                                        <label className={canEditTeam ? "block cursor-pointer group" : "block cursor-not-allowed opacity-50"}>
                                          <input type="file" accept="image/*" className="sr-only" disabled={!canEditTeam} onChange={async (e) => {
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
                                        <label className={canEditTeam ? "block cursor-pointer group" : "block cursor-not-allowed opacity-50"}>
                                          <input type="file" accept="image/*" className="sr-only" disabled={!canEditTeam} onChange={async (e) => {
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
                                    <p className="text-[10px] text-slate-500">{canEditTeam ? "Click either image to upload · PNG, JPG, WEBP · 4MB max" : "Only this team’s owner and the commissioner can change these."}</p>
                                  </div>

                                  {/* Actions */}
                                  <div className="space-y-2 pt-1">
                                    <p className="text-sm font-bold text-white">Actions</p>
                                    <button
                                      type="button"
                                      disabled={savingTeamId === team.id || !canEditTeam}
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

            {/* AUDIO / VIDEO TAB */}
            {tab === "audio" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-800/90 bg-slate-900/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Broadcast Package</p>
                      <h2 className="mt-1 text-base font-bold text-white">Audio & Presentation</h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">Tune draft-night sounds, announcer voice, team walk-up music, and celebration moments without losing operational clarity.</p>
                    </div>
                    <CommandStatusBadge label={settingsSaveState === "saving" ? "Saving" : settingsSaveState === "saved" ? "Saved" : "Auto Save"} tone={settingsSaveState === "saving" ? "warning" : settingsSaveState === "saved" ? "complete" : "neutral"} />
                  </div>
                </div>

                {/* ── Announcer Voice ── */}
                <div className={cardCls}>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Announcer</p>
                  <p className="mt-1 text-base font-bold text-white">Pick Announcements</p>
                  <p className="mt-1 mb-4 text-sm leading-6 text-slate-400">
                    Choose the voice used for pick announcements.
                    {isAiAnnouncerEnabled() && " AI announcers are generated in the cloud and sound the same on every device."}
                  </p>
                  <div className="flex items-center gap-3">
                    <select
                      disabled={!isCommissioner}
                      value={getAiAnnouncerId(announcerVoiceUri) ?? getAnnouncerVoiceProfile(announcerVoiceUri)}
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
                      {isAiAnnouncerEnabled() && AI_ANNOUNCER_PERSONAS.map((persona) => (
                        <option key={persona.id} value={persona.id}>{persona.label}</option>
                      ))}
                      <option value="drafthq:male">DraftHQ Male Announcer</option>
                      <option value="drafthq:female">DraftHQ Female Announcer</option>
                      {isAiAnnouncerEnabled() && elVoices.length > 0 && (
                        <optgroup label="Your ElevenLabs Voices">
                          {elVoices.map((voice) => (
                            <option key={voice.id} value={`${ELEVENLABS_VOICE_PREFIX}${voice.id}`}>
                              {voice.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {/* An EL voice chosen on another device (or before the list loads) */}
                      {isAiAnnouncerEnabled() && getElevenLabsVoiceId(announcerVoiceUri) &&
                        !elVoices.some((voice) => `${ELEVENLABS_VOICE_PREFIX}${voice.id}` === announcerVoiceUri) && (
                        <option value={announcerVoiceUri ?? ""}>ElevenLabs Custom Voice</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        const sample = "With pick one, your team selects a player.";
                        const aiId = getAiAnnouncerId(announcerVoiceUri);
                        if (aiId) {
                          const url = await fetchAnnouncerClipUrl(sample, aiId, draftId);
                          if (url) {
                            const audio = new Audio(url);
                            audio.volume = 0.9;
                            void audio.play().catch(() => {});
                            return;
                          }
                          // Generation unavailable — fall through to the device voice.
                        }
                        const utt = new SpeechSynthesisUtterance(sample);
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

                  {/* ── ElevenLabs bring-your-own account ── */}
                  {isAiAnnouncerEnabled() && (
                  <div className="mt-4 border-t border-slate-800 pt-4">
                    {elConnected ? (
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                            ElevenLabs connected
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {elVoices.length > 0
                              ? `${elVoices.length} voice${elVoices.length === 1 ? "" : "s"} from your library available in the picker above.`
                              : "Loading your voice library…"}{" "}
                            Your key is stored only in this browser.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!isCommissioner}
                          onClick={async () => {
                            storeElevenLabsKey(null);
                            setElConnected(false);
                            setElVoices([]);
                            // Don't leave the draft pointed at a voice nobody can generate.
                            if (getElevenLabsVoiceId(announcerVoiceUri)) {
                              setAnnouncerVoiceUri("drafthq:male");
                              if (draftId && setup) {
                                try {
                                  const updated = await updateDraftPresentation(draftId, { announcerVoiceUri: "drafthq:male" });
                                  setSetup({ ...setup, draft: updated });
                                } catch { /* setting reverts on next load */ }
                              }
                            }
                          }}
                          className="shrink-0 text-xs text-slate-500 underline transition-colors hover:text-red-400 disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-white">Bring your own ElevenLabs account</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                          Use any voice from your ElevenLabs library — including cloned voices — as the draft announcer.
                          Generation spends your account&apos;s credits: a full draft is roughly 15 minutes of audio, and the
                          free tier covers about 10, so a paid ElevenLabs plan is recommended for draft night. Your API key
                          stays in this browser and is never stored on DraftHQ&apos;s servers.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="password"
                            value={elKeyInput}
                            onChange={(e) => setElKeyInput(e.target.value)}
                            placeholder="ElevenLabs API key"
                            disabled={!isCommissioner || elBusy}
                            autoComplete="off"
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                          />
                          <button
                            type="button"
                            disabled={!isCommissioner || elBusy || !elKeyInput.trim()}
                            onClick={async () => {
                              const key = elKeyInput.trim();
                              setElBusy(true);
                              setElError("");
                              const voices = await listElevenLabsVoices(key);
                              setElBusy(false);
                              if (!voices) {
                                setElError("Couldn't connect — check the API key.");
                                return;
                              }
                              storeElevenLabsKey(key);
                              setElKeyInput("");
                              setElConnected(true);
                              setElVoices(voices);
                            }}
                            className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
                          >
                            {elBusy ? "Connecting…" : "Connect"}
                          </button>
                        </div>
                        {elError && <p className="mt-1.5 text-[11px] text-red-400">{elError}</p>}
                      </div>
                    )}
                  </div>
                  )}
                </div>

                {/* ── Draft Presentation ── */}
                <div className={cardCls}>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Presentation Cues</p>
                  <p className="mt-1 text-base font-bold text-white">Draft Presentation</p>
                  <p className="mt-1 mb-4 text-sm leading-6 text-slate-400">Configure pick announcements, draft start audio, and future player-video moments.</p>

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
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-[var(--color-league-accent)]"
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">Use &ldquo;Pick is in&hellip;&rdquo; feature</p>
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
                                <svg viewBox="0 0 20 14" fill="none" className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-league-accent)]">
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
                            <svg viewBox="0 0 20 14" fill="none" className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-league-accent)]">
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

                {/* ── Walk-Up Music Behavior ── */}
                <div className={cardCls}>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Walk-Up Music</p>
                  <p className="mt-1 text-base font-bold text-white">Between-Turn Behavior</p>
                  <p className="mt-1 mb-4 text-sm leading-6 text-slate-400">Control what happens to a team&apos;s walk-up song when they return to the clock in a later round.</p>

                  <div className="space-y-2">
                    {([
                      { value: "restart" as const, label: "Restart each turn", detail: "Every turn starts a walk-up song from the beginning." },
                      { value: "resume" as const, label: "Resume across turns", detail: "Each team's song continues from where it left off on their previous pick. When a song ends, the next one in their list starts." },
                    ]).map((opt) => (
                      <label key={opt.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 has-[:checked]:border-[color-mix(in_srgb,var(--color-league-accent-border)_50%,transparent)]">
                        <input
                          type="radio"
                          name="walkUpMusicMode"
                          checked={walkUpMusicMode === opt.value}
                          disabled={!isCommissioner}
                          onChange={async () => {
                            setWalkUpMusicMode(opt.value);
                            if (!draftId || !setup) return;
                            try {
                              const updated = await updateDraftPresentation(draftId, { walkUpMusicMode: opt.value });
                              setSetup({ ...setup, draft: updated });
                              flashSaved();
                            } catch (err) { setError(err instanceof Error ? err.message : "Unable to save."); }
                          }}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">{opt.label}</p>
                          <p className="text-xs text-slate-500">{opt.detail}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* ── End of Round Slide ── */}
                <div className={cardCls}>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Round Breaks</p>
                  <p className="mt-1 text-base font-bold text-white">End of Round Slide</p>
                  <p className="mt-1 mb-4 text-sm leading-6 text-slate-400">Show a recap at the end of each round before the next round begins.</p>

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
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-[var(--color-league-accent)]"
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
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-[var(--color-league-accent)]"
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
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Commissioner Controls</p>
                  <p className="mt-1 text-base font-bold text-white">Custom Sound Effects</p>
                  <p className="mt-1 mb-4 text-sm leading-6 text-slate-400">Audio clips played when SFX 1 or SFX 2 are clicked on the pick reveal card. Upload an MP3, WAV, or OGG, max 8 MB.</p>

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
                              <svg viewBox="0 0 20 14" fill="none" className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-league-accent)]">
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

                {/* Awards Ceremony Music */}
                <div className={cardCls}>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Finale</p>
                  <p className="mt-1 text-base font-bold text-white">Awards Ceremony Music</p>
                  <p className="mt-1 mb-4 text-sm leading-6 text-slate-400">
                    The song that plays during the end-of-draft awards ceremony. Pick anything from YouTube, or leave the DraftHQ default.
                  </p>

                  {awardsSong ? (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2.5">
                      {awardsSong.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={awardsSong.thumbnail} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                      ) : (
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-400">
                          <path d="M6 2v9.27A3 3 0 1 0 7 14V5h5V2H6z"/>
                        </svg>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{awardsSong.title}</p>
                        {awardsSong.artist && <p className="truncate text-xs text-slate-500">{awardsSong.artist}</p>}
                      </div>
                      {isCommissioner && (
                        <button
                          type="button"
                          title="Use the default track"
                          className="shrink-0 text-xs text-slate-500 underline transition-colors hover:text-red-400"
                          onClick={async () => {
                            setAwardsSong(null);
                            if (!draftId || !setup) return;
                            try {
                              const updated = await updateDraftPresentation(draftId, { clearAwardsSong: true });
                              setSetup({ ...setup, draft: updated });
                              flashSaved();
                            } catch (err) { setError(err instanceof Error ? err.message : "Unable to save."); }
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-sm text-slate-500">
                      Using the DraftHQ default celebration track.
                    </p>
                  )}

                  {isCommissioner && (
                    <button
                      type="button"
                      onClick={() => setShowAwardsSongPicker(true)}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:border-slate-500 hover:text-slate-300"
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                        <path d="M8 3v10M3 8h10" strokeLinecap="round"/>
                      </svg>
                      {awardsSong ? "Change song" : "Choose a song"}
                    </button>
                  )}
                </div>

                {/* Voice Reactions */}
                <div className={cardCls}>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Reactions</p>
                  <p className="mt-1 text-base font-bold text-white">Voice Reactions</p>
                  <p className="mt-1 mb-4 text-sm leading-6 text-slate-400">TTS phrases spoken when reaction buttons are clicked. One phrase is chosen at random.</p>

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
                      className="mt-4 rounded-lg bg-[var(--color-league-accent-hover)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-league-accent)] disabled:opacity-50 transition-colors">
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
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Readiness</p>
              <p className="mt-1 text-sm font-bold text-white">Draft Setup Summary</p>
              <p className="mt-1 mb-4 text-xs leading-5 text-slate-500">General settings autosave as each control changes. Team order changes are saved from the Teams & Order tab.</p>

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
                {/* Moved down from the hero, which is where it was the only
                    fact not already repeated here. */}
                <div className="col-span-2">
                  <dt className="text-xs text-slate-500">Draft date</dt>
                  {/* Was printing scheduledTimezone, so a row labelled "Draft
                      date" read "America/New York" and never showed the date. */}
                  <dd className="mt-0.5 text-sm font-semibold text-white">
                    {scheduledDate
                      ? `${formatScheduledDate(scheduledDate, scheduledTime)} ${formatTimeZoneName(scheduledTimezone)}`
                      : "Not scheduled"}
                  </dd>
                </div>
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
                    onClick={handlePrimaryAction}
                    disabled={isSaving}
                    className="mt-4 w-full rounded-xl py-2.5 text-sm font-black disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primary, color: secondary }}
                  >
                    {isSaving ? "Saving..." : primaryActionLabel}
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
      <div className={`lg:hidden fixed bottom-0 inset-x-0 z-20 border-t border-slate-800 bg-slate-950/90 backdrop-blur-sm px-4 py-3 flex items-center gap-3 ${fromDraft || tab !== "teams" ? "hidden" : ""}`}>
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

    {/* Awards ceremony song picker */}
    {showAwardsSongPicker && (
      <SongPicker
        onSelect={(song) => {
          setAwardsSong(song);
          setShowAwardsSongPicker(false);
          if (!draftId || !setup) return;
          void updateDraftPresentation(draftId, { awardsSong: song })
            .then((updated) => { setSetup({ ...setup, draft: updated }); flashSaved(); })
            .catch((err) => setError(err instanceof Error ? err.message : "Unable to save."));
        }}
        onClose={() => setShowAwardsSongPicker(false)}
      />
    )}

    {/* Draft order race — full-screen lottery reveal */}
    {showOrderRace && (
      <DraftOrderRace
        teams={teams}
        isCommissioner={isCommissioner}
        onClose={() => setShowOrderRace(false)}
        onLockIn={async (ordered) => {
          setTeams(ordered);
          try {
            if (draftId) await updateTeamSetup(draftId, ordered);
            setOrderDirty(false);
          } catch (e) {
            setOrderDirty(true);
            setError(e instanceof Error ? e.message : "Unable to save order.");
          }
          setShowOrderRace(false);
        }}
      />
    )}
    </>
  );
}

function LandmineRevealButton({ draftId }: { draftId: string }) {
  const [players, setPlayers] = useState<LandminedPlayer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleReveal = async () => {
    if (open) { setOpen(false); return; }
    setLoading(true);
    try {
      const result = await revealLandmines(draftId);
      setPlayers(result);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void handleReveal()}
        disabled={loading}
        className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors"
      >
        {loading ? "Loading…" : open ? "Hide" : "💣 Reveal"}
      </button>
      {open && players && (
        <div className="absolute left-0 top-9 z-20 w-64 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active Landmines ({players.length})
          </p>
          {players.length === 0 ? (
            <p className="text-xs text-slate-500">All landmines have been triggered.</p>
          ) : (
            <ul className="space-y-1.5">
              {players.map((p) => (
                <li key={p.playerId} className="flex items-center gap-2 text-sm text-white">
                  <span className="text-base">💣</span>
                  <span className="font-medium">{p.fullName}</span>
                  <span className="ml-auto text-xs text-slate-400">{p.position}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
