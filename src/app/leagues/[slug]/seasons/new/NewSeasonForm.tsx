"use client";

import React, { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import LeagueWorkspaceHeader from "@/components/LeagueWorkspaceHeader";
import SleeperImportForm from "@/components/SleeperImportForm";
import ProviderImportForm from "@/components/ProviderImportForm";
import { useLeagueWorkspace } from "@/hooks/useLeagueWorkspace";
import { createLeagueSeasonDraft } from "@/lib/leagueApi";
import {
  getEspnLeaguePreview,
  getFleaflickerLeaguePreview,
  getMflLeaguePreview,
  getYahooAuthUrl,
  getYahooLeaguePreview,
} from "@/lib/providerApi";
import type { ProviderLeaguePreview } from "@/lib/providers/types";

type ProviderId = "sleeper" | "espn" | "fleaflicker" | "mfl" | "yahoo";

interface ProviderCard {
  id: ProviderId | "coming-soon";
  label: string;
  description: string;
  available: boolean;
  logoDomain: string;
  logoColor: string;
}

const PROVIDERS: ProviderCard[] = [
  { id: "sleeper", label: "Sleeper", description: "Enter your Sleeper league ID.", available: true, logoDomain: "sleeper.com", logoColor: "#1a1f2e" },
  { id: "espn", label: "ESPN", description: "Enter your ESPN league ID and season year.", available: true, logoDomain: "espn.com", logoColor: "#cc0000" },
  { id: "fleaflicker", label: "Fleaflicker", description: "Enter your Fleaflicker league ID.", available: true, logoDomain: "fleaflicker.com", logoColor: "#1a6b2a" },
  { id: "mfl", label: "MyFantasyLeague", description: "Enter your MFL league ID and year.", available: true, logoDomain: "myfantasyleague.com", logoColor: "#003366" },
  { id: "yahoo", label: "Yahoo Fantasy", description: "Connect with Yahoo OAuth.", available: true, logoDomain: "yahoo.com", logoColor: "#6001d2" },
  { id: "coming-soon", label: "CBS Sports", description: "Coming soon.", available: false, logoDomain: "cbssports.com", logoColor: "#003087" },
  { id: "coming-soon", label: "Fantrax", description: "Coming soon.", available: false, logoDomain: "fantrax.com", logoColor: "#e8272f" },
];

export default function NewSeasonForm({ slug }: { slug: string }) {
  const router = useRouter();
  const { workspace, error: loadError, isLoading } = useLeagueWorkspace(slug);
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [seasonName, setSeasonName] = useState(`${currentYear} Season`);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [providerPreview, setProviderPreview] = useState<ProviderLeaguePreview | null>(null);

  const [draftName, setDraftName] = useState(`${currentYear} Draft`);
  const [teamCount, setTeamCount] = useState(12);
  const [rounds, setRounds] = useState(15);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  function resetProvider() {
    setSelectedProvider(null);
    setProviderPreview(null);
    setError("");
  }

  async function handleManualCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace) return;
    setError("");
    setIsCreating(true);
    try {
      const season = await createLeagueSeasonDraft({
        leagueId: workspace.league.id,
        year,
        seasonName,
        draftName,
        teamCount,
        rounds,
      });
      if (!season.draftId) throw new Error("The season was created without a draft.");
      router.push(`/teams?draftId=${season.draftId}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create the season.");
      setIsCreating(false);
    }
  }

  if (isLoading) return <main className="mx-auto max-w-5xl p-8">Loading league...</main>;
  if (loadError || !workspace) return <main className="mx-auto max-w-5xl p-8 text-red-500">{loadError || "League not found."}</main>;
  if (!workspace.canManage) return <main className="mx-auto max-w-5xl p-8 text-red-500">Only a league commissioner can create a season.</main>;

  const seasonContext = {
    leagueId: workspace.league.id,
    year,
    seasonName,
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <LeagueWorkspaceHeader league={workspace.league} canManage />

      <section>
        <h2 className="text-2xl font-bold">New Season</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block" htmlFor="season-year">Year</label>
            <input
              id="season-year"
              type="number"
              min={2000}
              max={2100}
              className="w-full rounded border p-2"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-2 block" htmlFor="season-name">Season Name</label>
            <input
              id="season-name"
              required
              maxLength={100}
              className="w-full rounded border p-2"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Import from a provider</h3>

        {!selectedProvider && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDERS.map((provider, index) => (
              <button
                key={`${provider.id}-${index}`}
                type="button"
                disabled={!provider.available}
                onClick={() =>
                  provider.available && provider.id !== "coming-soon"
                    ? setSelectedProvider(provider.id as ProviderId)
                    : undefined
                }
                className={[
                  "rounded-xl border p-4 text-left transition-colors",
                  provider.available
                    ? "border-gray-700 hover:border-blue-500 hover:bg-blue-950/20 cursor-pointer"
                    : "border-gray-800 opacity-40 cursor-not-allowed",
                ].join(" ")}
              >
                <div className="mb-3 flex items-center gap-3">
                  <ProviderLogo domain={provider.logoDomain} label={provider.label} color={provider.logoColor} />
                  <p className="font-semibold">{provider.label}</p>
                </div>
                <p className="text-sm text-gray-400">{provider.description}</p>
              </button>
            ))}
          </div>
        )}

        {selectedProvider === "sleeper" && (
          <div className="mt-4">
            <div className="mb-3">
              <button type="button" onClick={resetProvider} className="text-sm text-gray-400 hover:text-white">
                ← Providers
              </button>
            </div>
            <SleeperImportForm seasonContext={seasonContext} />
          </div>
        )}

        {selectedProvider && selectedProvider !== "sleeper" && !providerPreview && (
          <ProviderCredentialForm
            provider={selectedProvider}
            year={String(year)}
            onPreview={setProviderPreview}
            onBack={resetProvider}
          />
        )}

        {selectedProvider && selectedProvider !== "sleeper" && providerPreview && (
          <div className="rounded-xl border border-gray-700 p-5">
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setProviderPreview(null)}
                className="text-sm text-gray-400 hover:text-white"
              >
                ← Back
              </button>
              <span className="text-gray-600">|</span>
              <span className="text-sm font-semibold capitalize">{selectedProvider}</span>
            </div>
            <ProviderImportForm
              preview={providerPreview}
              seasonContext={seasonContext}
              onBack={() => setProviderPreview(null)}
            />
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span className="h-px flex-1 bg-gray-800" />
        Or create manually
        <span className="h-px flex-1 bg-gray-800" />
      </div>

      <form className="space-y-4 rounded-xl border border-gray-700 p-5" onSubmit={handleManualCreate}>
        <div>
          <label className="mb-2 block" htmlFor="season-draft-name">Draft Name</label>
          <input id="season-draft-name" required maxLength={100} className="w-full rounded border p-2" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block" htmlFor="season-team-count">Teams</label>
            <input id="season-team-count" type="number" min={2} max={20} className="w-full rounded border p-2" value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-2 block" htmlFor="season-rounds">Rounds</label>
            <input id="season-rounds" type="number" min={1} max={30} className="w-full rounded border p-2" value={rounds} onChange={(e) => setRounds(Number(e.target.value))} />
          </div>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <button type="submit" disabled={isCreating} className="rounded bg-blue-600 px-4 py-2 font-semibold disabled:opacity-50">
          {isCreating ? "Creating..." : "Create Season and Draft"}
        </button>
      </form>
    </main>
  );
}

const PROVIDER_SVGS: Record<string, React.ReactNode> = {
  "sleeper.com": (
    // Robot face: navy bg, round white/gray head, dark visor, teal eyes, antenna
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sl-bg" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#253560"/>
          <stop offset="100%" stopColor="#111d38"/>
        </radialGradient>
        <radialGradient id="sl-head" cx="65%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="60%" stopColor="#c8d4e8"/>
          <stop offset="100%" stopColor="#8090a8"/>
        </radialGradient>
        <radialGradient id="sl-eye-l" cx="70%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#00f0d0"/>
          <stop offset="100%" stopColor="#00a888"/>
        </radialGradient>
        <radialGradient id="sl-eye-r" cx="30%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#00f0d0"/>
          <stop offset="100%" stopColor="#00a888"/>
        </radialGradient>
      </defs>
      <rect width="36" height="36" rx="8" fill="url(#sl-bg)"/>
      {/* Antenna ball */}
      <circle cx="18" cy="5.5" r="2.5" fill="#c8d4e4"/>
      {/* Antenna stem */}
      <rect x="17.1" y="7.5" width="1.8" height="4" rx="0.9" fill="#8898b0"/>
      {/* Head */}
      <ellipse cx="18" cy="22" rx="13.5" ry="11.5" fill="url(#sl-head)"/>
      {/* Dark visor/face */}
      <ellipse cx="18" cy="25" rx="10.5" ry="6.5" fill="#0f1828"/>
      {/* Left eye — angled slash shape */}
      <path d="M10.5 23.8 C11.5 21.5 14 21.8 15.5 23.2 C14.2 25 11.5 25.2 10.5 23.8Z" fill="url(#sl-eye-l)"/>
      {/* Right eye */}
      <path d="M25.5 23.8 C24.5 21.5 22 21.8 20.5 23.2 C21.8 25 24.5 25.2 25.5 23.8Z" fill="url(#sl-eye-r)"/>
    </svg>
  ),
  "espn.com": (
    // Blue bg, lime shield outline, lime E inside
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="8" fill="#0820cc"/>
      {/* Shield — classic heraldic shape, pointed at bottom */}
      <path
        d="M18 4.5L28 8.5V20C28 26.5 23.5 30.5 18 33C12.5 30.5 8 26.5 8 20V8.5L18 4.5Z"
        fill="none"
        stroke="#c8f000"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* E — bold, fills shield interior */}
      <text x="18" y="26" textAnchor="middle" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="16" fill="#c8f000">E</text>
    </svg>
  ),
  "fleaflicker.com": (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="8" fill="#1a6b2a"/>
      <text x="18" y="25" textAnchor="middle" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="16" fill="white">FF</text>
    </svg>
  ),
  "myfantasyleague.com": (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="8" fill="#003366"/>
      <text x="18" y="24" textAnchor="middle" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="12" fill="white">MFL</text>
    </svg>
  ),
  "yahoo.com": (
    // Purple bg, white trophy with handles, "yahoo!" text
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="yh-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9340ff"/>
          <stop offset="100%" stopColor="#5c10cc"/>
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="8" fill="url(#yh-bg)"/>
      {/* Cup body */}
      <path d="M12 5.5h12v10c0 3.3-2.7 6-6 6s-6-2.7-6-6V5.5Z" fill="white" opacity="0.95"/>
      {/* Left handle */}
      <path d="M12 7.5C9 7.5 7.5 9 7.5 11s1.5 3.5 4.5 3.5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Right handle */}
      <path d="M24 7.5C27 7.5 28.5 9 28.5 11s-1.5 3.5-4.5 3.5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Ribbon tag on cup rim */}
      <path d="M17 7.5 L18 10 L19 7.5" fill="#c0a0ff" opacity="0.8"/>
      {/* Stem */}
      <rect x="16.5" y="21.5" width="3" height="4" fill="white" opacity="0.9"/>
      {/* Base */}
      <rect x="12.5" y="25.5" width="11" height="2.5" rx="1.2" fill="white" opacity="0.9"/>
      {/* yahoo! */}
      <text x="18" y="33.5" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontWeight="bold" fontSize="6" fill="white">yahoo!</text>
    </svg>
  ),
  "cbssports.com": (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="8" fill="#003087"/>
      <text x="18" y="24" textAnchor="middle" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="12" fill="white">CBS</text>
    </svg>
  ),
  "fantrax.com": (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="8" fill="#e8272f"/>
      <text x="18" y="25" textAnchor="middle" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="18" fill="white">F</text>
    </svg>
  ),
};

function ProviderLogo({ domain, label }: { domain: string; label: string; color: string }) {
  const svg = PROVIDER_SVGS[domain];
  if (svg) {
    return <span className="flex h-9 w-9 shrink-0 items-center justify-center">{svg}</span>;
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-700 text-sm font-bold">
      {label[0]}
    </span>
  );
}

interface ProviderCredentialFormProps {
  provider: ProviderId;
  year: string;
  onPreview: (preview: ProviderLeaguePreview) => void;
  onBack: () => void;
}

function ProviderCredentialForm({
  provider,
  year,
  onPreview,
  onBack,
}: ProviderCredentialFormProps) {
  const [leagueId, setLeagueId] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showPrivate, setShowPrivate] = useState(false);
  const [yahooConnected, setYahooConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleYahooConnect() {
    setError("");
    setIsConnecting(true);
    try {
      const authUrl = await getYahooAuthUrl();
      const popup = window.open(authUrl, "yahoo_oauth", "width=600,height=700");
      if (!popup) {
        throw new Error("Popup blocked. Allow popups for this site and try again.");
      }
      await new Promise<void>((resolve, reject) => {
        function onMessage(event: MessageEvent) {
          if (event.origin !== window.location.origin) return;
          const data = event.data as { type?: string; error?: string | null };
          if (data.type !== "yahoo_oauth_done") return;
          window.removeEventListener("message", onMessage);
          if (data.error) reject(new Error(data.error));
          else resolve();
        }
        window.addEventListener("message", onMessage);
        // Clean up if popup is closed without completing
        const interval = setInterval(() => {
          if (popup.closed) {
            clearInterval(interval);
            window.removeEventListener("message", onMessage);
            reject(new Error("Yahoo authorization window was closed."));
          }
        }, 500);
      });
      setYahooConnected(true);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Yahoo connection failed.");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = leagueId.trim();

    if (provider === "yahoo") {
      if (!yahooConnected) {
        setError("Connect your Yahoo account first.");
        return;
      }
      if (!id || !/^\d+\.l\.\d+$/.test(id)) {
        setError('Enter a valid Yahoo league key (e.g. "423.l.123456").');
        return;
      }
    } else if (!id || !/^\d+$/.test(id)) {
      setError("Enter a valid numeric league ID.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      let preview: ProviderLeaguePreview;

      if (provider === "espn") {
        preview = await getEspnLeaguePreview({
          leagueId: id,
          year,
          espnS2: espnS2.trim() || undefined,
          swid: swid.trim() || undefined,
        });
      } else if (provider === "fleaflicker") {
        preview = await getFleaflickerLeaguePreview({ leagueId: id });
      } else if (provider === "mfl") {
        preview = await getMflLeaguePreview({
          leagueId: id,
          year,
          apiKey: apiKey.trim() || undefined,
        });
      } else if (provider === "yahoo") {
        preview = await getYahooLeaguePreview({ leagueKey: id });
      } else {
        throw new Error("Unknown provider.");
      }

      onPreview(preview);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Unable to load the league."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const providerLabel: Record<ProviderId, string> = {
    sleeper: "Sleeper",
    espn: "ESPN",
    fleaflicker: "Fleaflicker",
    mfl: "MyFantasyLeague",
    yahoo: "Yahoo",
  };

  return (
    <div className="rounded-xl border border-gray-700 p-5">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-sm text-gray-400 hover:text-white">
          ← Providers
        </button>
        <span className="text-gray-600">|</span>
        <span className="font-semibold">{providerLabel[provider]}</span>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm" htmlFor="provider-league-id">
            {provider === "yahoo" ? "League Key" : "League ID"}
          </label>
          <input
            id="provider-league-id"
            required
            inputMode={provider === "yahoo" ? "text" : "numeric"}
            placeholder={provider === "yahoo" ? "e.g. 423.l.123456" : "Numeric league ID"}
            className="w-full rounded border p-2"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
          />
        </div>

        {provider === "espn" && (
          <div>
            <button
              type="button"
              className="text-sm text-blue-400 underline"
              onClick={() => setShowPrivate((v) => !v)}
            >
              {showPrivate ? "Hide" : "Private league? Add cookies"}
            </button>
            {showPrivate && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-gray-500">
                  Find these in your browser cookies on espn.com (Application → Cookies).
                </p>
                <div>
                  <label className="mb-1 block text-sm" htmlFor="espn-s2">espn_s2</label>
                  <input
                    id="espn-s2"
                    type="password"
                    className="w-full rounded border p-2 font-mono text-sm"
                    value={espnS2}
                    onChange={(e) => setEspnS2(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm" htmlFor="espn-swid">SWID</label>
                  <input
                    id="espn-swid"
                    type="password"
                    placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
                    className="w-full rounded border p-2 font-mono text-sm"
                    value={swid}
                    onChange={(e) => setSwid(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {provider === "mfl" && (
          <div>
            <label className="mb-2 block text-sm" htmlFor="mfl-api-key">
              API Key <span className="text-gray-500">(optional — required for private leagues)</span>
            </label>
            <input
              id="mfl-api-key"
              type="password"
              placeholder="Found in MFL account settings"
              className="w-full rounded border p-2"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        )}

        {provider === "yahoo" && !yahooConnected && (
          <button
            type="button"
            disabled={isConnecting}
            onClick={() => void handleYahooConnect()}
            className="w-full rounded bg-purple-700 px-4 py-2 font-semibold disabled:opacity-50"
          >
            {isConnecting ? "Opening Yahoo..." : "Connect Yahoo Account"}
          </button>
        )}

        {provider === "yahoo" && yahooConnected && (
          <p className="text-sm text-green-400">Yahoo account connected.</p>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded bg-blue-600 px-4 py-2 font-semibold disabled:opacity-50"
        >
          {isLoading ? "Loading preview..." : "Preview Import"}
        </button>
      </form>
    </div>
  );
}
