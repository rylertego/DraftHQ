"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getLeagueSettings, updateLeagueSettings } from "@/lib/leagueApi";
import { supabase } from "@/lib/supabase";
import type { LeagueTheme } from "@/types/league";

const THEMES: { value: LeagueTheme; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "broadcast", label: "Broadcast" },
  { value: "dark", label: "Dark" },
  { value: "modern", label: "Modern" },
];

async function uploadLeagueAsset(file: File, leagueId: string, folder: "logos" | "banners"): Promise<string> {
  // Try Supabase Storage first; fall back to base64 data URL if bucket isn't configured
  try {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${folder}/${leagueId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("league-assets").upload(path, file, { upsert: true });
    if (!error) return supabase.storage.from("league-assets").getPublicUrl(path).data.publicUrl;
  } catch {
    // storage not configured — fall through
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Image upload field ────────────────────────────────────────────────────────
function ImageUploadField({
  label,
  displayUrl,
  disabled,
  aspectRatio = "square",
  onSelect,
  onClear,
}: {
  label: string;
  displayUrl: string;
  disabled?: boolean;
  aspectRatio?: "square" | "banner";
  onSelect: (file: File, previewUrl: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const prevObjectUrl = useRef<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (prevObjectUrl.current) URL.revokeObjectURL(prevObjectUrl.current);
    const url = URL.createObjectURL(file);
    prevObjectUrl.current = url;
    onSelect(file, url);
    // reset so same file can be re-selected
    e.target.value = "";
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div
          className={`shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 ${
            aspectRatio === "square" ? "h-16 w-16" : "h-14 w-28"
          }`}
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
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-teal-500 hover:text-white disabled:opacity-50 transition-colors"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 11v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Upload
          </button>
          {displayUrl && (
            <button
              type="button"
              disabled={disabled}
              onClick={onClear}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-500 hover:border-red-700 hover:text-red-400 disabled:opacity-50 transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </div>
    </div>
  );
}

// ── Color picker field ────────────────────────────────────────────────────────
function ColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="h-10 w-10 shrink-0 rounded-xl border-2 border-slate-600 shadow-inner hover:border-teal-400 disabled:opacity-50 transition-colors"
          style={{ backgroundColor: value }}
          aria-label={`Pick ${label}`}
        />
        <input
          ref={inputRef}
          type="color"
          className="sr-only"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          maxLength={7}
          disabled={disabled}
          className="w-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 disabled:opacity-50 focus:border-teal-500 focus:outline-none"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
        />
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function LeagueSettingsForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#14B8A6");
  const [secondaryColor, setSecondaryColor] = useState("#0F172A");
  const [theme, setTheme] = useState<LeagueTheme>("classic");
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");

  const [pendingLogo, setPendingLogo] = useState<{ file: File; preview: string } | null>(null);
  const [pendingBanner, setPendingBanner] = useState<{ file: File; preview: string } | null>(null);

  useEffect(() => {
    let active = true;
    void getLeagueSettings(slug)
      .then((s) => {
        if (!active) return;
        setLeagueId(s.league.id);
        setName(s.league.name);
        setLogoUrl(s.league.logoUrl ?? "");
        setBannerUrl(s.league.bannerUrl ?? "");
        setPrimaryColor(s.league.primaryColor ?? "#14B8A6");
        setSecondaryColor(s.league.secondaryColor ?? "#0F172A");
        setTheme(s.league.theme);
        setCanManage(s.canManage);
      })
      .catch(() => { if (active) router.replace("/login"); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [router, slug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setSaveState("idle");
    try {
      let finalLogo = logoUrl;
      let finalBanner = bannerUrl;

      if (pendingLogo) {
        finalLogo = await uploadLeagueAsset(pendingLogo.file, leagueId, "logos");
        setLogoUrl(finalLogo);
        setPendingLogo(null);
      }
      if (pendingBanner) {
        finalBanner = await uploadLeagueAsset(pendingBanner.file, leagueId, "banners");
        setBannerUrl(finalBanner);
        setPendingBanner(null);
      }

      await updateLeagueSettings(leagueId, {
        name, logoUrl: finalLogo, bannerUrl: finalBanner,
        primaryColor, secondaryColor, theme,
      });
      setSaveState("saved");
      setTimeout(() => router.push(`/leagues/${slug}`), 1000);
    } catch {
      setSaveState("error");
    } finally {
      setIsSaving(false);
    }
  }

  const displayLogoUrl = pendingLogo?.preview ?? logoUrl;
  const displayBannerUrl = pendingBanner?.preview ?? bannerUrl;
  const themeLabel = THEMES.find((t) => t.value === theme)?.label ?? theme;

  if (isLoading) {
    return <main className="w-full p-8 text-slate-400">Loading league...</main>;
  }

  return (
    <main className="w-full px-6 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Link href={`/leagues/${slug}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white transition-colors">
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-3xl font-bold text-white">League Settings</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-8 lg:grid-cols-[1fr_260px]">

          {/* ── Left: form sections ── */}
          <div className="space-y-6">

            {/* Identity */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
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

                <ImageUploadField
                  label="Logo"
                  displayUrl={displayLogoUrl}
                  disabled={!canManage}
                  aspectRatio="square"
                  onSelect={(file, preview) => setPendingLogo({ file, preview })}
                  onClear={() => { setPendingLogo(null); setLogoUrl(""); }}
                />

                <ImageUploadField
                  label="Banner"
                  displayUrl={displayBannerUrl}
                  disabled={!canManage}
                  aspectRatio="banner"
                  onSelect={(file, preview) => setPendingBanner({ file, preview })}
                  onClear={() => { setPendingBanner(null); setBannerUrl(""); }}
                />
              </div>
            </div>

            {/* Colors & Theme */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <h2 className="mb-5 text-xs font-bold uppercase tracking-wider text-slate-500">Colors & Theme</h2>
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <ColorField label="Primary Color" value={primaryColor} disabled={!canManage} onChange={setPrimaryColor} />
                  <ColorField label="Secondary Color" value={secondaryColor} disabled={!canManage} onChange={setSecondaryColor} />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="league-theme">
                    Theme
                  </label>
                  <select
                    id="league-theme"
                    disabled={!canManage}
                    className="w-full disabled:opacity-50"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as LeagueTheme)}
                  >
                    {THEMES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: sticky summary ── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Summary</p>

              {/* Logo + name */}
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
                  {displayLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayLogoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-slate-600">
                      {name.slice(0, 1).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{name || "—"}</p>
                  <p className="text-xs text-slate-500">{themeLabel}</p>
                </div>
              </div>

              {/* Banner preview */}
              {displayBannerUrl && (
                <div className="mb-5 h-14 w-full overflow-hidden rounded-xl border border-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={displayBannerUrl} alt="" className="h-full w-full object-cover" />
                </div>
              )}

              {/* Colors */}
              <div className="mb-5 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Primary</p>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 shrink-0 rounded-full border border-slate-600" style={{ backgroundColor: primaryColor }} />
                    <span className="font-mono text-[11px] text-slate-400">{primaryColor}</span>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Secondary</p>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 shrink-0 rounded-full border border-slate-600" style={{ backgroundColor: secondaryColor }} />
                    <span className="font-mono text-[11px] text-slate-400">{secondaryColor}</span>
                  </div>
                </div>
              </div>

              {/* Save */}
              {canManage ? (
                <button
                  type="submit"
                  disabled={isSaving}
                  className={[
                    "w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50",
                    saveState === "saved"
                      ? "border border-teal-700 bg-teal-950/60 text-teal-400"
                      : saveState === "error"
                      ? "border border-red-700 bg-red-950/60 text-red-400"
                      : "bg-teal-500 text-slate-950 hover:bg-teal-400",
                  ].join(" ")}
                >
                  {isSaving ? "Saving..." : saveState === "saved" ? "Saved ✓" : saveState === "error" ? "Error — retry" : "Save Settings"}
                </button>
              ) : (
                <p className="text-center text-xs text-slate-600">You don&apos;t have permission to edit this league.</p>
              )}
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
