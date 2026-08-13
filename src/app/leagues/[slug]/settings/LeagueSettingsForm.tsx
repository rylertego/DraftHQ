"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { disconnectLeagueIntegration, getLeagueSettings, syncSleeperLeagueHistory, updateLeagueSettings } from "@/lib/leagueApi";
import type { SleeperHistorySyncResult } from "@/lib/leagueApi";
import { supabase } from "@/lib/supabase";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import type { LeagueTheme } from "@/types/league";
import {
  CommandButton,
  CommandPanel,
  CommandStatusBadge,
  commandHelperClass,
  commandInputClass,
  commandLabelClass,
} from "@/components/CommandCenterUI";
import LeagueMembers from "../members/LeagueMembers";

interface ColorPair {
  name: string;
  primary: string;
  secondary: string;
}

const COLOR_PAIRS: ColorPair[] = [
  { name: "Teal",    primary: "#14B8A6", secondary: "#0D1F1E" },
  { name: "Royal",   primary: "#3B82F6", secondary: "#0D1426" },
  { name: "Emerald", primary: "#10B981", secondary: "#062016" },
  { name: "Violet",  primary: "#A855F7", secondary: "#180D26" },
  { name: "Crimson", primary: "#EF4444", secondary: "#1C0A0A" },
  { name: "Gold",    primary: "#F59E0B", secondary: "#1C1308" },
  { name: "Rose",    primary: "#F43F5E", secondary: "#1C0812" },
  { name: "Indigo",  primary: "#6366F1", secondary: "#0F1033" },
  { name: "Cyan",    primary: "#22D3EE", secondary: "#061820" },
  { name: "Sunset",  primary: "#FB923C", secondary: "#1C0E06" },
];

const PROVIDER_ICONS = {
  sleeper: "/providers/sleeper.png",
  espn: "/providers/espn.png",
  yahoo: "/providers/yahoo.png",
} as const;

// ── League asset uploads ──────────────────────────────────────────────────────
// Matches the league-assets bucket's own limit, so anything that reaches the
// upload is a size the bucket will accept.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

// Path is {leagueId}/{type}.{ext} — the stable UUID prefix the storage policy
// scopes on. Keep this in step with 20260806000000_league_assets_bucket.sql.
async function uploadLeagueAsset(file: File, leagueId: string, folder: "logos" | "banners"): Promise<string> {
  const type = folder === "logos" ? "logo" : "banner";
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${leagueId}/${type}.${ext}`;
  const bucket = supabase.storage.from("league-assets");

  // Uploading a .webp over a .png writes a new object rather than replacing the
  // old one, so clear same-type siblings before writing.
  const { data: existing } = await bucket.list(leagueId);
  const stale = (existing ?? [])
    .filter((object) => object.name.startsWith(`${type}.`) && object.name !== `${type}.${ext}`)
    .map((object) => `${leagueId}/${object.name}`);
  if (stale.length > 0) await bucket.remove(stale);

  const { error } = await bucket.upload(path, file, { upsert: true, contentType: file.type });
  // Fail loudly. The silent data-URL fallback this replaces is exactly what hid
  // a missing bucket — and shipped a 200KB base64 logo on every workspace load.
  if (error) throw new Error(error.message);

  // The path is stable now, so the public URL is too. Bust the CDN cache or a
  // replaced logo keeps rendering as the old one.
  return `${bucket.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDismiss }: { msg: string; type: "success" | "error"; onDismiss: () => void }) {
  const { accentColor: primary } = useLeagueTheme();
  const successStyle = type === "success"
    ? { borderColor: primary + "60", backgroundColor: primary + "18", color: primary }
    : undefined;
  return (
    <div
      style={{ animation: "toast-in 0.22s ease-out forwards", left: "50%", transform: "translateX(-50%)", ...successStyle }}
      className={`fixed top-4 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 shadow-2xl text-sm font-medium whitespace-nowrap ${
        type === "error" ? "border-red-700/60 bg-red-950 text-red-300" : ""
      }`}
    >
      {type === "error" ? (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 5v3M8 10.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {msg}
      <button type="button" onClick={onDismiss} className="ml-1 opacity-50 hover:opacity-100 transition-opacity">
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// ── Image upload field ────────────────────────────────────────────────────────
function ImageUploadField({
  label, displayUrl, disabled, aspectRatio = "square", sizeHint, onSelect, onClear, onError,
}: {
  label: string;
  displayUrl: string;
  disabled?: boolean;
  aspectRatio?: "square" | "banner";
  sizeHint?: string;
  onSelect: (file: File, previewUrl: string) => void;
  onClear: () => void;
  onError?: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const prevObjectUrl = useRef<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      onError?.("Image too large — maximum is 4 MB");
      e.target.value = "";
      return;
    }
    if (prevObjectUrl.current) URL.revokeObjectURL(prevObjectUrl.current);
    const url = URL.createObjectURL(file);
    prevObjectUrl.current = url;
    onSelect(file, url);
    e.target.value = "";
  }

  return (
    <div>
      <p className={commandLabelClass}>{label}</p>
      <div className="flex items-center gap-4 rounded-xl bg-slate-950/35 p-3 ring-1 ring-white/10">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={`group relative shrink-0 overflow-hidden rounded-xl border border-dashed border-slate-600/90 bg-slate-950/70 transition-colors hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${aspectRatio === "square" ? "h-20 w-20" : "h-16 w-32"}`}
          aria-label={`Upload ${label.toLowerCase()}`}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-700">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
          <span className="absolute inset-x-0 bottom-0 bg-slate-950/82 px-2 py-1.5 text-center text-[10px] font-black uppercase tracking-[0.14em] text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            {displayUrl ? "Replace" : "Upload"}
          </span>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Upload
            </button>
            {displayUrl && (
              <button type="button" disabled={disabled} onClick={onClear}
                className="inline-flex min-h-10 items-center rounded-xl border border-slate-700/80 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40">
                Remove
              </button>
            )}
          </div>
          {sizeHint && <p className={commandHelperClass}>{sizeHint}</p>}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </div>
    </div>
  );
}

// ── Color pair picker ─────────────────────────────────────────────────────────
function ColorPairPicker({
  primaryColor,
  secondaryColor,
  disabled,
  onChange,
}: {
  primaryColor: string;
  secondaryColor: string;
  disabled?: boolean;
  onChange: (primary: string, secondary: string) => void;
}) {
  return (
    <div>
      <p className={commandLabelClass}>League Colors</p>
      <p className="mb-3 text-sm leading-6 text-slate-400">Choose the broadcast accent and dark field color used across league surfaces.</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {COLOR_PAIRS.map((pair) => {
          const isSelected =
            pair.primary.toLowerCase() === primaryColor.toLowerCase() &&
            pair.secondary.toLowerCase() === secondaryColor.toLowerCase();
          return (
            <button
              key={pair.name}
              type="button"
              disabled={disabled}
              onClick={() => onChange(pair.primary, pair.secondary)}
              title={pair.name}
              className={`group relative min-h-[88px] overflow-hidden rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-slate-950 ${
                isSelected
                  ? "border-white shadow-[0_12px_28px_rgba(59,130,246,0.22)]"
                  : "border-slate-800 hover:border-slate-600"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {/* Mini preview card */}
              <div className="flex h-16 w-full flex-col items-center justify-center gap-1.5 px-2" style={{ backgroundColor: pair.secondary }}>
                <div className="w-full rounded-md py-1 text-center text-[9px] font-bold" style={{ backgroundColor: pair.primary, color: pair.secondary }}>
                  Draft
                </div>
                <div className="w-3/4 rounded-md border py-0.5" style={{ borderColor: pair.primary, opacity: 0.7 }} />
              </div>
              {/* Name label */}
              <div className="bg-slate-900 py-1 text-center text-[10px] font-semibold text-slate-400">
                {pair.name}
              </div>
              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                  <svg className="h-2.5 w-2.5 text-slate-900" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function LeagueSettingsForm({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { reload: reloadWorkspace } = useWorkspace();
  const { setAccentColor, setBgColor } = useLeagueTheme();
  const [leagueId, setLeagueId] = useState("");
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState(COLOR_PAIRS[0].primary);
  const [secondaryColor, setSecondaryColor] = useState(COLOR_PAIRS[0].secondary);
  const [theme] = useState<LeagueTheme>("classic");
  const [teamCount, setTeamCount] = useState(12);
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState<"general" | "members" | "integrations">(
    () => (searchParams.get("tab") as "general" | "members" | "integrations" | null) ?? "general"
  );
  const [sleeperLeagueId, setSleeperLeagueId] = useState("");
  const [sleeperLastSyncedAt, setSleeperLastSyncedAt] = useState<string | null>(null);
  const [isSyncingSleeper, setIsSyncingSleeper] = useState(false);
  const [sleeperResult, setSleeperResult] = useState<SleeperHistorySyncResult | null>(null);
  const [activeIntegration, setActiveIntegration] = useState<"sleeper" | "espn" | "yahoo" | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [pendingLogo, setPendingLogo] = useState<{ file: File; preview: string } | null>(null);
  const [pendingBanner, setPendingBanner] = useState<{ file: File; preview: string } | null>(null);
  const [savedGeneral, setSavedGeneral] = useState({
    name: "",
    logoUrl: "",
    bannerUrl: "",
    primaryColor: COLOR_PAIRS[0].primary,
    secondaryColor: COLOR_PAIRS[0].secondary,
    teamCount: 12,
  });

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function slugFromName(n: string) {
    return n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function showToast(msg: string, type: "success" | "error" = "error") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  useEffect(() => {
    let active = true;
    void getLeagueSettings(slug)
      .then((s) => {
        if (!active) return;
        setLeagueId(s.league.id);
        setName(s.league.name);
        setLogoUrl(s.league.logoUrl ?? "");
        setBannerUrl(s.league.bannerUrl ?? "");
        const primary   = s.league.primaryColor   ?? COLOR_PAIRS[0].primary;
        const secondary = s.league.secondaryColor ?? COLOR_PAIRS[0].secondary;
        setPrimaryColor(primary);
        setSecondaryColor(secondary);
        setAccentColor(primary);
        setBgColor(secondary);
        setTeamCount(s.league.teamCount ?? 12);
        setSavedGeneral({
          name: s.league.name,
          logoUrl: s.league.logoUrl ?? "",
          bannerUrl: s.league.bannerUrl ?? "",
          primaryColor: primary,
          secondaryColor: secondary,
          teamCount: s.league.teamCount ?? 12,
        });
        setSleeperLeagueId(s.league.sleeperLeagueId ?? "");
        setSleeperLastSyncedAt(s.league.sleeperLastSyncedAt);
        setActiveIntegration(s.league.activeIntegration);
        setCanManage(s.canManage);
      })
      .catch(() => { if (active) router.replace("/login"); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [router, slug, setAccentColor, setBgColor]);

  async function handleDisconnect() {
    if (!leagueId) return;
    setIsDisconnecting(true);
    try {
      await disconnectLeagueIntegration(leagueId);
      setActiveIntegration(null);
      setSleeperLeagueId("");
      setSleeperLastSyncedAt(null);
      setSleeperResult(null);
      showToast("Integration disconnected", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { showToast("League name is required"); return; }
    setIsSaving(true);
    try {
      let finalLogo = logoUrl;
      let finalBanner = bannerUrl;

      if (pendingLogo) {
        try {
          finalLogo = await uploadLeagueAsset(pendingLogo.file, leagueId, "logos");
          setLogoUrl(finalLogo);
          setPendingLogo(null);
        } catch {
          showToast("Logo upload failed — try a smaller image");
          setIsSaving(false);
          return;
        }
      }
      if (pendingBanner) {
        try {
          finalBanner = await uploadLeagueAsset(pendingBanner.file, leagueId, "banners");
          setBannerUrl(finalBanner);
          setPendingBanner(null);
        } catch {
          showToast("Banner upload failed — try a smaller image");
          setIsSaving(false);
          return;
        }
      }

      const saved = await updateLeagueSettings(leagueId, {
        name, slug: slugFromName(name), logoUrl: finalLogo, bannerUrl: finalBanner,
        primaryColor, secondaryColor, theme, teamCount,
      });
      setSavedGeneral({ name: name.trim(), logoUrl: finalLogo, bannerUrl: finalBanner, primaryColor, secondaryColor, teamCount });
      reloadWorkspace();
      showToast("Settings saved", "success");
      if (saved.slug !== slug) {
        router.replace(`/leagues/${saved.slug}/settings`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("42501") || msg.includes("commissioner")) {
        showToast("Only commissioners can edit league settings");
      } else if (msg.includes("too large") || msg.includes("54000")) {
        showToast("Image too large — try a smaller file");
      } else {
        showToast("Save failed — please try again");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSleeperSync(e: FormEvent) {
    e.preventDefault();
    if (!sleeperLeagueId.trim()) { showToast("Enter a Sleeper league ID"); return; }
    setIsSyncingSleeper(true);
    setSleeperResult(null);
    try {
      const result = await syncSleeperLeagueHistory(leagueId, sleeperLeagueId.trim());
      setSleeperResult(result);
      setSleeperLeagueId(result.sleeperLeagueId);
      setSleeperLastSyncedAt(result.syncedAt);
      setActiveIntegration("sleeper");
      await reloadWorkspace();
      showToast(`Synced ${result.seasonYear} Sleeper history`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Sleeper sync failed");
    } finally {
      setIsSyncingSleeper(false);
    }
  }

  const displayLogoUrl = pendingLogo?.preview ?? logoUrl;
  const displayBannerUrl = pendingBanner?.preview ?? bannerUrl;
  const hasUnsavedGeneral =
    name.trim() !== savedGeneral.name ||
    logoUrl !== savedGeneral.logoUrl ||
    bannerUrl !== savedGeneral.bannerUrl ||
    primaryColor !== savedGeneral.primaryColor ||
    secondaryColor !== savedGeneral.secondaryColor ||
    teamCount !== savedGeneral.teamCount ||
    Boolean(pendingLogo || pendingBanner);
  const connectedProvider = activeIntegration
    ? activeIntegration.charAt(0).toUpperCase() + activeIntegration.slice(1)
    : "None";
  const showSleeperIntegration = !activeIntegration || activeIntegration === "sleeper";
  const showUnavailableIntegrations = !activeIntegration;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-800/90 bg-slate-900/72 p-8 text-sm font-semibold text-slate-400">
        Loading league settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

      <section className="overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/72 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <div className="relative px-6 py-6">
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: primaryColor }} />
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: primaryColor }}>League Command Center</p>
            <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">League Settings</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Manage league identity, access, and connected history sources from one commissioner workspace.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-800/80 px-6">
          <div className="flex gap-6" role="tablist" aria-label="League settings sections">
            {(["general", "members", "integrations"] as const).map((t) => {
              const active = tab === t;
              const label = t === "general" ? "General" : t === "members" ? "Members" : "Integrations";
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t)}
                  className={`group relative py-4 text-sm font-black transition-colors focus-visible:outline-none ${
                    active ? "text-white" : "text-slate-500 hover:text-slate-200"
                  }`}
                >
                  {label}
                  <span
                    className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full transition-opacity ${
                      active ? "opacity-100" : "opacity-0 group-hover:opacity-40 group-focus-visible:opacity-100"
                    }`}
                    style={{ backgroundColor: primaryColor }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {tab === "members" && <LeagueMembers slug={slug} embedded />}

      {tab === "integrations" && (
        <div className="space-y-5">
          <CommandPanel
            eyebrow="League History"
            title="Connected Sources"
            description={activeIntegration
              ? `${connectedProvider} is connected for completed season history.`
              : "Connect supported fantasy platforms to import completed season history."}
          >
            <div className="space-y-4">
              {showSleeperIntegration && (
                <div className="rounded-xl border border-slate-800/90 bg-slate-950/35 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={PROVIDER_ICONS.sleeper} alt="Sleeper" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-white">Sleeper</h3>
                          <CommandStatusBadge label={activeIntegration === "sleeper" ? "Connected" : "Available"} tone={activeIntegration === "sleeper" ? "complete" : "ready"} />
                        </div>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                          Import the latest completed season champion and final standings from a public Sleeper league. No Sleeper password or OAuth login is needed.
                        </p>
                        {sleeperLastSyncedAt && (
                          <p className="mt-2 text-xs font-semibold text-slate-500">Last synced {new Date(sleeperLastSyncedAt).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    {activeIntegration === "sleeper" && canManage && (
                      <CommandButton type="button" variant="secondary" onClick={handleDisconnect} disabled={isDisconnecting} className="sm:min-w-32">
                        {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                      </CommandButton>
                    )}
                  </div>

                  <form onSubmit={handleSleeperSync} className="mt-5 border-t border-slate-800/80 pt-5">
                    <label htmlFor="sleeper-league-id" className={commandLabelClass}>Sleeper League ID</label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        id="sleeper-league-id"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="e.g. 123456789012345678"
                        value={sleeperLeagueId}
                        onChange={(event) => setSleeperLeagueId(event.target.value.replace(/\D/g, ""))}
                        disabled={!canManage || isSyncingSleeper}
                        className={`${commandInputClass} min-w-0 flex-1`}
                      />
                      <CommandButton
                        type="submit"
                        variant="primary"
                        disabled={!canManage || isSyncingSleeper || !sleeperLeagueId.trim()}
                        className="sm:min-w-40"
                        style={{ backgroundColor: primaryColor, color: secondaryColor }}
                      >
                        {isSyncingSleeper ? "Syncing..." : sleeperLastSyncedAt ? "Sync Again" : "Connect & Sync"}
                      </CommandButton>
                    </div>
                    <p className={commandHelperClass}>Sync is manual and only runs when you press this button.</p>
                  </form>

                  {sleeperResult && (
                    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/45 p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-white">{sleeperResult.seasonYear} season</p>
                        <CommandStatusBadge
                          label={`${sleeperResult.mappedTeams}/${sleeperResult.totalTeams} Matched`}
                          tone={sleeperResult.unmappedTeams.length > 0 ? "warning" : "complete"}
                        />
                      </div>
                      <div className="mt-3 space-y-2 leading-6">
                        {sleeperResult.unmappedTeams.length > 0 && (
                          <p className="text-amber-200"><span className="font-semibold">Unmatched Sleeper names:</span> {sleeperResult.unmappedTeams.join(", ")}</p>
                        )}
                        {sleeperResult.draftHqTeamNames && sleeperResult.draftHqTeamNames.length > 0 && (
                          <p className="text-slate-400"><span className="font-semibold text-slate-300">DraftHQ team names found:</span> {sleeperResult.draftHqTeamNames.join(", ")}</p>
                        )}
                        {sleeperResult.draftHqTeamNames?.length === 0 && (
                          <p className="font-semibold text-red-300">No league teams found in DraftHQ for this league. Add teams on the Teams page first.</p>
                        )}
                        {sleeperResult.leagueTeamsError && (
                          <p className="text-xs text-red-300"><span className="font-semibold">DB error:</span> {sleeperResult.leagueTeamsError}</p>
                        )}
                        {sleeperResult.unmappedTeams.length > 0 && (sleeperResult.draftHqTeamNames?.length ?? 0) > 0 && (
                          <p className="text-xs text-slate-500">Names are compared after lowercasing and removing spaces/punctuation. Update DraftHQ team names on the Teams page to match Sleeper, then sync again.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {showUnavailableIntegrations && ([
                { id: "espn", name: "ESPN", copy: "Import ESPN Fantasy league history, standings, and champion once provider support is ready." },
                { id: "yahoo", name: "Yahoo", copy: "Import Yahoo Fantasy league history, standings, and champion via OAuth once provider support is ready." },
              ] as const).map((provider) => (
                <div key={provider.id} className="rounded-xl border border-slate-800/80 bg-slate-950/25 p-4 opacity-80">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={PROVIDER_ICONS[provider.id]} alt={provider.name} width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-white">{provider.name}</h3>
                          <CommandStatusBadge label="Coming Soon" tone="neutral" />
                        </div>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{provider.copy}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CommandPanel>
        </div>
      )}

      {tab === "general" && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <CommandPanel
            eyebrow="Core Configuration"
            title="League Identity"
            description="These settings define how the league appears in DraftHQ workspaces, teams, and draft-night surfaces."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={commandLabelClass} htmlFor="settings-league-name">League Name</label>
                <input
                  id="settings-league-name"
                  required
                  maxLength={100}
                  disabled={!canManage}
                  className={commandInputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!name.trim()}
                />
                <p className={commandHelperClass}>Shown in the sidebar, dashboard, invitations, and league-level pages.</p>
              </div>

              <div>
                <label className={commandLabelClass} htmlFor="settings-team-count">Active Teams</label>
                <p className="mb-2 text-sm leading-6 text-slate-400">Number of active franchise teams. Archived teams do not count toward this total.</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!canManage || teamCount <= 2}
                    onClick={() => setTeamCount((n) => Math.max(2, n - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/70 text-lg font-black text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Decrease active teams"
                  >
                    -
                  </button>
                  <input
                    id="settings-team-count"
                    type="number"
                    min={2}
                    max={32}
                    disabled={!canManage}
                    className={`${commandInputClass} w-20 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                    value={teamCount}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 2 && v <= 32) setTeamCount(v);
                    }}
                  />
                  <button
                    type="button"
                    disabled={!canManage || teamCount >= 32}
                    onClick={() => setTeamCount((n) => Math.min(32, n + 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/70 text-lg font-black text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Increase active teams"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </CommandPanel>

          <CommandPanel
            eyebrow="Brand System"
            title="League Branding"
            description="Customize the crest, banner, and broadcast colors that make this league feel distinct."
          >
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <ImageUploadField
                  label="Logo"
                  displayUrl={displayLogoUrl}
                  disabled={!canManage}
                  aspectRatio="square"
                  sizeHint="4 MB max. Square recommended."
                  onSelect={(file, preview) => setPendingLogo({ file, preview })}
                  onClear={() => { setPendingLogo(null); setLogoUrl(""); }}
                  onError={showToast}
                />

                <ImageUploadField
                  label="Banner"
                  displayUrl={displayBannerUrl}
                  disabled={!canManage}
                  aspectRatio="banner"
                  sizeHint="4 MB max. 16:9 recommended."
                  onSelect={(file, preview) => setPendingBanner({ file, preview })}
                  onClear={() => { setPendingBanner(null); setBannerUrl(""); }}
                  onError={showToast}
                />
              </div>

              <div className="border-t border-slate-800/80 pt-5">
                <ColorPairPicker
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                  disabled={!canManage}
                  onChange={(p, s) => { setPrimaryColor(p); setSecondaryColor(s); setAccentColor(p); setBgColor(s); }}
                />
              </div>
            </div>
          </CommandPanel>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-800/90 bg-slate-900/72 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-400">
              Save Settings applies league identity and branding changes.
            </p>
            {canManage && (
              <CommandButton
                type="submit"
                variant="primary"
                disabled={isSaving || !hasUnsavedGeneral}
                className="w-full sm:w-auto sm:min-w-40"
                style={{ backgroundColor: primaryColor, color: secondaryColor }}
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </CommandButton>
            )}
            {!canManage && <p className="text-sm font-semibold text-slate-500">You do not have permission to edit this league.</p>}
          </div>
        </form>
      )}
    </div>
  );
}
