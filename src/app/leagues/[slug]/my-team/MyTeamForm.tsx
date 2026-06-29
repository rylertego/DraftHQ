"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { getLeagueTeams, updateLeagueTeamDetails, uploadLeagueTeamLogo } from "@/lib/leagueApi";
import type { LeagueTeam } from "@/types/league";

export default function MyTeamForm(_: { slug: string }) {
  const { workspace, isLoading } = useWorkspace();
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [team, setTeam] = useState<LeagueTeam | null>(null);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const league = workspace?.league;
  const myTeamRef = workspace?.myTeam;

  useEffect(() => {
    if (!league || !myTeamRef) return;
    let active = true;
    void getLeagueTeams(league.id).then((teams) => {
      if (!active) return;
      const found = teams.find((t) => t.id === myTeamRef.id) ?? null;
      if (found) {
        setTeam(found);
        setName(found.name);
        setShortName(found.shortName ?? "");
        setOwnerName(found.ownerName ?? "");
        setLogoPreview(found.logoUrl);
      }
    });
    return () => { active = false; };
  }, [league, myTeamRef]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!team || !league || !name.trim()) return;
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      let logoUrl = team.logoUrl;
      if (logoFile) {
        setUploadingLogo(true);
        logoUrl = await uploadLeagueTeamLogo(league.id, team.id, logoFile);
        setUploadingLogo(false);
      }
      await updateLeagueTeamDetails(league.id, team.id, {
        name: name.trim(),
        shortName: shortName.trim() || null,
        ownerName: ownerName.trim() || null,
        logoUrl,
      });
      setTeam((prev) => prev ? { ...prev, name: name.trim(), shortName: shortName.trim() || null, ownerName: ownerName.trim() || null, logoUrl } : prev);
      setLogoFile(null);
      setSuccess(true);
    } catch (err) {
      setUploadingLogo(false);
      setError(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-800" />;
  }

  if (!myTeamRef) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
        <p className="text-slate-400">You don&apos;t have a team assigned in this league.</p>
        <p className="mt-1 text-sm text-slate-600">Ask the commissioner to assign you as a team owner.</p>
      </div>
    );
  }

  const initials = (team?.name ?? myTeamRef.name).trim().slice(0, 2).toUpperCase() || "T";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Team</h1>
        <p className="mt-1 text-sm text-slate-500">Edit your team profile for {league?.name}.</p>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-5">
        {/* Logo upload */}
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-slate-600 hover:border-slate-400 transition-colors"
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-black text-white bg-slate-800">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <div>
            <p className="font-semibold text-white">Team Logo</p>
            <p className="mt-0.5 text-xs text-slate-500">Click to upload · PNG, JPG, WEBP · 4MB max</p>
            {uploadingLogo && <p className="mt-1 text-xs" style={{ color: primary }}>Uploading…</p>}
          </div>
        </div>

        {/* Name fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Team Name <span className="text-red-400">*</span>
            </label>
            <input
              required
              maxLength={100}
              className="w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Short Name</label>
            <input
              maxLength={10}
              className="w-full"
              placeholder="e.g. Eagles"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Display Name</label>
          <input
            maxLength={100}
            className="w-full"
            placeholder="Display name shown during the draft"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>
        )}
        {success && (
          <p className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-400">Team saved successfully.</p>
        )}

        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() => void handleSave()}
          className="w-full rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: primary, color: secondary }}
        >
          {saving ? (uploadingLogo ? "Uploading…" : "Saving…") : "Save Team"}
        </button>
      </div>
    </div>
  );
}
