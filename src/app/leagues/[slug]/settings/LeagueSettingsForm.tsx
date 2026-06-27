"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getLeagueSettings, updateLeagueSettings } from "@/lib/leagueApi";
import { supabase } from "@/lib/supabase";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import type { LeagueTheme } from "@/types/league";
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

// ── Image compression ─────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function compressImage(file: File, maxPx: number, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const isPng = file.type === "image/png";
      resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", isPng ? undefined : quality));
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

async function uploadLeagueAsset(file: File, leagueId: string, folder: "logos" | "banners"): Promise<string> {
  try {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${folder}/${leagueId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("league-assets").upload(path, file, { upsert: true });
    if (!error) return supabase.storage.from("league-assets").getPublicUrl(path).data.publicUrl;
  } catch {
    // storage bucket not configured — fall through
  }
  const maxPx = folder === "logos" ? 256 : 1200;
  return compressImage(file, maxPx, 0.82);
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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center gap-4">
        <div className={`shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 ${aspectRatio === "square" ? "h-16 w-16" : "h-14 w-28"}`}>
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
        </div>
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Upload
            </button>
            {displayUrl && (
              <button type="button" disabled={disabled} onClick={onClear}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-500 hover:border-red-700 hover:text-red-400 disabled:opacity-50 transition-colors">
                Remove
              </button>
            )}
          </div>
          {sizeHint && <p className="mt-1.5 text-[11px] text-slate-600">{sizeHint}</p>}
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
  const selected = COLOR_PAIRS.find(
    (p) => p.primary.toLowerCase() === primaryColor.toLowerCase() &&
           p.secondary.toLowerCase() === secondaryColor.toLowerCase()
  );

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">League Colors</p>
      <div className="grid grid-cols-5 gap-2.5">
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
              className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                isSelected
                  ? "border-white scale-105 shadow-lg"
                  : "border-transparent hover:border-slate-500 hover:scale-102"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {/* Mini preview card */}
              <div className="h-16 w-full flex flex-col items-center justify-center gap-1.5 px-2" style={{ backgroundColor: pair.secondary }}>
                <div className="w-full rounded-md py-1 text-[9px] font-bold text-center" style={{ backgroundColor: pair.primary, color: pair.secondary }}>
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
  const [tab, setTab] = useState<"general" | "members">("general");

  const [pendingLogo, setPendingLogo] = useState<{ file: File; preview: string } | null>(null);
  const [pendingBanner, setPendingBanner] = useState<{ file: File; preview: string } | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setCanManage(s.canManage);
      })
      .catch(() => { if (active) router.replace("/login"); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [router, slug, setAccentColor, setBgColor]);

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

      await updateLeagueSettings(leagueId, {
        name, logoUrl: finalLogo, bannerUrl: finalBanner,
        primaryColor, secondaryColor, theme, teamCount,
      });
      reloadWorkspace();
      showToast("Settings saved", "success");
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

  const displayLogoUrl = pendingLogo?.preview ?? logoUrl;
  const displayBannerUrl = pendingBanner?.preview ?? bannerUrl;
  const selectedPair = COLOR_PAIRS.find(
    (p) => p.primary.toLowerCase() === primaryColor.toLowerCase()
  );

  if (isLoading) {
    return <div className="p-8 text-slate-400">Loading league...</div>;
  }

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

      <h1 className="mb-6 text-3xl font-bold text-white">League Settings</h1>

      {/* Tabs */}
      <div className="mb-8 flex gap-1 border-b border-slate-800">
        {(["general", "members"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="px-5 pb-3 pt-1 text-sm font-semibold capitalize transition-colors"
            style={
              tab === t
                ? { color: primaryColor, borderBottom: `2px solid ${primaryColor}`, marginBottom: "-1px" }
                : { color: "#94a3b8", borderBottom: "2px solid transparent", marginBottom: "-1px" }
            }
          >
            {t === "general" ? "General" : "Members"}
          </button>
        ))}
      </div>

      {tab === "members" && <LeagueMembers slug={slug} />}

      {tab === "general" && <form onSubmit={handleSubmit}>
        <div className="grid gap-8 lg:grid-cols-[1fr_260px]">

          {/* ── Left ── */}
          <div className="space-y-6">

            {/* Identity */}
            <div className="rounded-2xl border bg-slate-900 p-6" style={{ borderColor: primaryColor + "44" }}>
              <h2 className="mb-5 text-xs font-bold uppercase tracking-wider text-slate-500">League Identity</h2>
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="settings-league-name">
                    League Name
                  </label>
                  <input
                    id="settings-league-name"
                    required
                    maxLength={100}
                    disabled={!canManage}
                    className="w-full disabled:opacity-50"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="settings-team-count">
                    Active Teams
                  </label>
                  <p className="mb-2 text-xs text-slate-600">Number of active franchise teams. Archived teams don&apos;t count toward this total.</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!canManage || teamCount <= 2}
                      onClick={() => setTeamCount((n) => Math.max(2, n - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors text-lg font-bold"
                    >
                      −
                    </button>
                    <input
                      id="settings-team-count"
                      type="number"
                      min={2}
                      max={32}
                      disabled={!canManage}
                      className="w-16 text-center disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors text-lg font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <ImageUploadField
                  label="Logo"
                  displayUrl={displayLogoUrl}
                  disabled={!canManage}
                  aspectRatio="square"
                  sizeHint="4 MB max · Square recommended"
                  onSelect={(file, preview) => setPendingLogo({ file, preview })}
                  onClear={() => { setPendingLogo(null); setLogoUrl(""); }}
                  onError={showToast}
                />

                <ImageUploadField
                  label="Banner"
                  displayUrl={displayBannerUrl}
                  disabled={!canManage}
                  aspectRatio="banner"
                  sizeHint="4 MB max · 16:9 recommended"
                  onSelect={(file, preview) => setPendingBanner({ file, preview })}
                  onClear={() => { setPendingBanner(null); setBannerUrl(""); }}
                  onError={showToast}
                />
              </div>
            </div>

            {/* Colors */}
            <div className="rounded-2xl border bg-slate-900 p-6" style={{ borderColor: primaryColor + "44" }}>
              <h2 className="mb-5 text-xs font-bold uppercase tracking-wider text-slate-500">Colors</h2>
              <ColorPairPicker
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                disabled={!canManage}
                onChange={(p, s) => { setPrimaryColor(p); setSecondaryColor(s); setAccentColor(p); setBgColor(s); }}
              />
            </div>
          </div>

          {/* ── Right: sticky summary ── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border bg-slate-900 p-5" style={{ borderColor: primaryColor + "44" }}>
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Summary</p>

              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
                  {displayLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayLogoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-slate-600">{name.slice(0, 1).toUpperCase() || "?"}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{name || "—"}</p>
                  <p className="text-xs text-slate-500">{selectedPair?.name ?? "Custom"} · {teamCount} teams</p>
                </div>
              </div>

              {displayBannerUrl && (
                <div className="mb-5 h-14 w-full overflow-hidden rounded-xl border" style={{ borderColor: primaryColor + "44" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={displayBannerUrl} alt="" className="h-full w-full object-cover" />
                </div>
              )}

              {/* Color preview */}
              <div className="mb-5 overflow-hidden rounded-xl border" style={{ borderColor: primaryColor + "44" }}>
                <div className="flex h-12 items-center justify-center gap-2 px-3" style={{ backgroundColor: secondaryColor }}>
                  <div className="rounded-md px-3 py-1 text-xs font-bold" style={{ backgroundColor: primaryColor, color: secondaryColor }}>
                    {selectedPair?.name ?? "Custom"}
                  </div>
                  <div className="flex-1 rounded-md border py-1.5" style={{ borderColor: primaryColor, opacity: 0.6 }} />
                </div>
              </div>

              {canManage ? (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wider transition-opacity disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: primaryColor, color: secondaryColor }}
                >
                  {isSaving ? "Saving..." : "Save Settings"}
                </button>
              ) : (
                <p className="text-center text-xs text-slate-600">You don&apos;t have permission to edit this league.</p>
              )}
            </div>
          </div>
        </div>
      </form>}
    </div>
  );
}
