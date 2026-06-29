"use client";

import { FormEvent, useState } from "react";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { getSleeperLeaguePreview } from "@/lib/draftApi";
import { importLeagueTeams } from "@/lib/leagueApi";
import {
  getEspnLeaguePreview,
  getYahooAuthUrl,
  getYahooLeaguePreview,
} from "@/lib/providerApi";
import type { ProviderLeaguePreview } from "@/lib/providers/types";

type Provider = "sleeper" | "espn" | "yahoo";

interface ImportPreview {
  leagueName: string;
  teams: Array<{ name: string; ownerName: string }>;
  warnings: string[];
}

const PROVIDERS: Array<{ id: Provider; label: string; logo: string; description: string }> = [
  { id: "sleeper", label: "Sleeper", logo: "/providers/sleeper.png", description: "Import with a Sleeper league ID." },
  { id: "espn", label: "ESPN", logo: "/providers/espn.png", description: "Import a public or private ESPN league." },
  { id: "yahoo", label: "Yahoo", logo: "/providers/yahoo.png", description: "Connect Yahoo, then import a league." },
];

function normalizePreview(preview: ProviderLeaguePreview): ImportPreview {
  return {
    leagueName: preview.leagueName,
    teams: preview.teams.map((team) => ({ name: team.teamName, ownerName: team.ownerName })),
    warnings: preview.warnings,
  };
}

export default function LeagueImportModal({
  leagueId,
  availableSlots,
  onClose,
  onImported,
}: {
  leagueId: string;
  availableSlots: number;
  onClose: () => void;
  onImported: (count: number) => Promise<void> | void;
}) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [leagueKey, setLeagueKey] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [showPrivate, setShowPrivate] = useState(false);
  const [yahooConnected, setYahooConnected] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function resetProvider() {
    setProvider(null);
    setPreview(null);
    setLeagueKey("");
    setError("");
  }

  async function connectYahoo() {
    setError("");
    setLoading(true);
    try {
      const authUrl = await getYahooAuthUrl();
      const popup = window.open(authUrl, "yahoo_oauth", "width=600,height=700");
      if (!popup) throw new Error("Popup blocked. Allow popups for this site and try again.");
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (failure?: Error) => {
          if (settled) return;
          settled = true;
          clearInterval(interval);
          window.removeEventListener("message", onMessage);
          failure ? reject(failure) : resolve();
        };
        function onMessage(event: MessageEvent) {
          if (event.origin !== window.location.origin) return;
          const data = event.data as { type?: string; error?: string | null };
          if (data.type !== "yahoo_oauth_done") return;
          finish(data.error ? new Error(data.error) : undefined);
        }
        window.addEventListener("message", onMessage);
        const interval = window.setInterval(() => {
          if (popup.closed) finish(new Error("Yahoo authorization window was closed."));
        }, 500);
      });
      setYahooConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yahoo connection failed.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview(event: FormEvent) {
    event.preventDefault();
    if (!provider) return;
    const id = leagueKey.trim();
    setError("");
    setLoading(true);
    try {
      let next: ImportPreview;
      if (provider === "sleeper") {
        const sleeper = await getSleeperLeaguePreview(id);
        next = {
          leagueName: sleeper.leagueName,
          teams: sleeper.teams.map((team) => ({ name: team.teamName, ownerName: team.managerName })),
          warnings: sleeper.warnings,
        };
      } else if (provider === "espn") {
        next = normalizePreview(await getEspnLeaguePreview({
          leagueId: id,
          year,
          espnS2: espnS2.trim() || undefined,
          swid: swid.trim() || undefined,
        }));
      } else {
        if (!yahooConnected) throw new Error("Connect your Yahoo account first.");
        next = normalizePreview(await getYahooLeaguePreview({ leagueKey: id }));
      }
      if (next.teams.length > availableSlots) {
        throw new Error(`This import has ${next.teams.length} teams, but the league has ${availableSlots} open slot${availableSlots === 1 ? "" : "s"}.`);
      }
      setPreview(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to preview the league.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setError("");
    setLoading(true);
    try {
      await importLeagueTeams(leagueId, preview.teams.map((team) => ({ name: team.name, ownerName: team.ownerName })));
      await onImported(preview.teams.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import teams.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-8" role="dialog" aria-modal="true" aria-labelledby="import-league-title">
      <div className="my-auto w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="import-league-title" className="text-xl font-bold text-white">Import League</h2>
            <p className="mt-1 text-sm text-slate-400">{provider ? "Enter the provider league details." : "Choose Provider"}</p>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50" aria-label="Close import dialog">✕</button>
        </div>

        {!provider && (
          <div className="grid gap-3 sm:grid-cols-3">
            {PROVIDERS.map((item) => (
              <button key={item.id} type="button" onClick={() => setProvider(item.id)} className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-left transition-colors hover:border-slate-500 hover:bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.logo} alt="" className="mb-3 h-10 w-10 rounded-xl object-cover" />
                <p className="font-bold text-white">{item.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.description}</p>
              </button>
            ))}
          </div>
        )}

        {provider && !preview && (
          <form onSubmit={(event) => void loadPreview(event)} className="space-y-4">
            <button type="button" onClick={resetProvider} disabled={loading} className="text-sm text-slate-400 hover:text-white">← Providers</button>
            {provider === "yahoo" && (
              <button type="button" disabled={loading || yahooConnected} onClick={() => void connectYahoo()} className="w-full rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-600 disabled:opacity-60">
                {yahooConnected ? "Yahoo account connected" : loading ? "Connecting..." : "Connect Yahoo Account"}
              </button>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={provider === "sleeper" || provider === "yahoo" ? "sm:col-span-2" : ""}>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="import-league-key">{provider === "yahoo" ? "League Key" : "League ID"}</label>
                <input id="import-league-key" required inputMode={provider === "yahoo" ? "text" : "numeric"} placeholder={provider === "yahoo" ? "423.l.123456" : "Numeric league ID"} className="w-full" value={leagueKey} onChange={(event) => setLeagueKey(event.target.value)} />
              </div>
              {provider === "espn" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="import-season-year">Season Year</label>
                  <input id="import-season-year" required type="number" min={2000} max={2100} className="w-full" value={year} onChange={(event) => setYear(event.target.value)} />
                </div>
              )}
            </div>
            {provider === "espn" && (
              <div>
                <button type="button" onClick={() => setShowPrivate((value) => !value)} className="text-sm" style={{ color: primary }}>{showPrivate ? "Hide private league cookies" : "Private league? Add cookies"}</button>
                {showPrivate && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="password" aria-label="ESPN espn_s2 cookie" placeholder="espn_s2" className="w-full font-mono" value={espnS2} onChange={(event) => setEspnS2(event.target.value)} />
                    <input type="password" aria-label="ESPN SWID cookie" placeholder="SWID" className="w-full font-mono" value={swid} onChange={(event) => setSwid(event.target.value)} />
                  </div>
                )}
              </div>
            )}
            {error && <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={loading || (provider === "yahoo" && !yahooConnected)} className="rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: primary, color: secondary }}>{loading ? "Loading preview..." : "Preview Import"}</button>
            </div>
          </form>
        )}

        {preview && (
          <div className="space-y-4">
            <button type="button" onClick={() => { setPreview(null); setError(""); }} disabled={loading} className="text-sm text-slate-400 hover:text-white">← Back</button>
            <div>
              <h3 className="font-bold text-white">{preview.leagueName}</h3>
              <p className="text-sm text-slate-400">{preview.teams.length} teams will be added.</p>
            </div>
            {preview.warnings.map((warning) => <p key={warning} className="rounded-lg border border-yellow-800/60 bg-yellow-950/30 px-3 py-2 text-sm text-yellow-300">{warning}</p>)}
            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {preview.teams.map((team, index) => (
                <div key={`${team.name}-${index}`} className="rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-white">{team.name}</p>
                  <p className="truncate text-xs text-slate-400">{team.ownerName || "Owner not provided"}</p>
                </div>
              ))}
            </div>
            {error && <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={loading} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void confirmImport()} disabled={loading} className="rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: primary, color: secondary }}>{loading ? "Importing teams..." : `Import ${preview.teams.length} Teams`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
