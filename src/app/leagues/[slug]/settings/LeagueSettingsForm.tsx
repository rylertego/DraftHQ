"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getLeagueSettings,
  updateLeagueSettings,
} from "@/lib/leagueApi";
import type { LeagueMember, LeagueTheme } from "@/types/league";

interface LeagueSettingsFormProps {
  slug: string;
}

export default function LeagueSettingsForm({ slug }: LeagueSettingsFormProps) {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [theme, setTheme] = useState<LeagueTheme>("classic");
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    void getLeagueSettings(slug)
      .then((settings) => {
        if (!active) return;
        setLeagueId(settings.league.id);
        setName(settings.league.name);
        setLogoUrl(settings.league.logoUrl ?? "");
        setBannerUrl(settings.league.bannerUrl ?? "");
        setPrimaryColor(settings.league.primaryColor ?? "");
        setSecondaryColor(settings.league.secondaryColor ?? "");
        setTheme(settings.league.theme);
        setMembers(settings.members);
        setCanManage(settings.canManage);
      })
      .catch(() => {
        if (active) router.replace("/login");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, slug]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const league = await updateLeagueSettings(leagueId, {
        name,
        logoUrl,
        bannerUrl,
        primaryColor,
        secondaryColor,
        theme,
      });
      setName(league.name);
      setMessage("League settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save league settings."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <main className="mx-auto max-w-3xl p-8">Loading league...</main>;
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <section>
        <h1 className="text-3xl font-bold">League Settings</h1>
        <p className="text-gray-400">/{slug}</p>
      </section>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block" htmlFor="settings-league-name">League Name</label>
          <input id="settings-league-name" required maxLength={100} disabled={!canManage} className="w-full rounded border p-2 disabled:opacity-60" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label className="mb-2 block" htmlFor="league-logo-url">Logo URL</label>
          <input id="league-logo-url" type="url" maxLength={2048} disabled={!canManage} className="w-full rounded border p-2 disabled:opacity-60" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} />
        </div>
        <div>
          <label className="mb-2 block" htmlFor="league-banner-url">Banner URL</label>
          <input id="league-banner-url" type="url" maxLength={2048} disabled={!canManage} className="w-full rounded border p-2 disabled:opacity-60" value={bannerUrl} onChange={(event) => setBannerUrl(event.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block" htmlFor="league-primary-color">Primary Color</label>
            <input id="league-primary-color" type="color" disabled={!canManage} className="h-11 w-full rounded border p-1 disabled:opacity-60" value={primaryColor || "#2563eb"} onChange={(event) => setPrimaryColor(event.target.value)} />
          </div>
          <div>
            <label className="mb-2 block" htmlFor="league-secondary-color">Secondary Color</label>
            <input id="league-secondary-color" type="color" disabled={!canManage} className="h-11 w-full rounded border p-1 disabled:opacity-60" value={secondaryColor || "#111827"} onChange={(event) => setSecondaryColor(event.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-2 block" htmlFor="league-theme">Theme</label>
          <select id="league-theme" disabled={!canManage} className="w-full rounded border bg-gray-900 p-2 disabled:opacity-60" value={theme} onChange={(event) => setTheme(event.target.value as LeagueTheme)}>
            <option value="classic">Classic</option>
            <option value="broadcast">Broadcast</option>
            <option value="dark">Dark</option>
            <option value="modern">Modern</option>
          </select>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        {message && <p className="text-green-400">{message}</p>}
        {canManage && (
          <button type="submit" disabled={isSaving} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        )}
      </form>

      <section>
        <h2 className="mb-3 text-xl font-bold">Members</h2>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between rounded border border-gray-700 p-3">
              <span>{member.displayName}</span>
              <span className="text-sm capitalize text-gray-400">{member.role}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
