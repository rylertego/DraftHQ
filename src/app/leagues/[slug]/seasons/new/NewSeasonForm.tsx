"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SleeperImportForm from "@/components/SleeperImportForm";
import ProviderImportForm from "@/components/ProviderImportForm";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { createLeagueSeasonDraft, getLeagueTeams } from "@/lib/leagueApi";
import type { LeagueTeam } from "@/types/league";
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
  const { workspace, isLoading, error: loadError } = useWorkspace();
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
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

  const [franchiseTeams, setFranchiseTeams] = useState<LeagueTeam[]>([]);
  const hasFranchises = franchiseTeams.length > 0;

  // Lock team count to league's active team setting
  useEffect(() => {
    if (workspace) setTeamCount(workspace.league.teamCount);
  }, [workspace]);

  useEffect(() => {
    if (!workspace) return;
    void getLeagueTeams(workspace.league.id).then((teams) => {
      setFranchiseTeams(teams.filter((t) => !t.archivedAt));
    });
  }, [workspace]);

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
      router.push(`/teams?draftId=${season.draftId}&tab=settings&leagueSlug=${slug}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create the season.");
      setIsCreating(false);
    }
  }

  if (isLoading) return <div className="px-6 py-8 text-slate-400">Loading league...</div>;
  if (loadError || !workspace) return <div className="px-6 py-8 text-red-500">{loadError || "League not found."}</div>;
  if (!workspace.canManage) return <div className="px-6 py-8 text-red-500">Only a league commissioner can create a season.</div>;

  const seasonContext = {
    leagueId: workspace.league.id,
    year,
    seasonName,
  };

  return (
    <div className="w-full space-y-6">

      <section>
        <h2 className="text-2xl font-bold">New Season</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="season-year">Year</label>
            <input
              id="season-year"
              type="number"
              min={2000}
              max={2100}
              className="w-full"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="season-name">Season Name</label>
            <input
              id="season-name"
              required
              maxLength={100}
              className="w-full"
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
                  provider.available ? "cursor-pointer" : "border-slate-800 opacity-40 cursor-not-allowed",
                ].join(" ")}
                style={provider.available ? { borderColor: primary + "44" } : undefined}
              >
                <div className="mb-3 flex items-center gap-3">
                  <ProviderLogo domain={provider.logoDomain} label={provider.label} color={provider.logoColor} />
                  <p className="font-semibold">{provider.label}</p>
                </div>
                <p className="text-sm text-slate-400">{provider.description}</p>
              </button>
            ))}
          </div>
        )}

        {selectedProvider === "sleeper" && (
          <div className="mt-4">
            <div className="mb-3">
              <button type="button" onClick={resetProvider} className="text-sm text-slate-400 hover:text-white">
                ← Providers
              </button>
            </div>
            <SleeperImportForm seasonContext={seasonContext} leagueSlug={slug} />
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
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setProviderPreview(null)}
                className="text-sm text-slate-400 hover:text-white"
              >
                ← Back
              </button>
              <span className="text-slate-700">|</span>
              <span className="text-sm font-semibold capitalize">{selectedProvider}</span>
            </div>
            <ProviderImportForm
              preview={providerPreview}
              seasonContext={seasonContext}
              onBack={() => setProviderPreview(null)}
              leagueSlug={slug}
            />
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
        <span className="h-px flex-1 bg-slate-800" />
        Or create manually
        <span className="h-px flex-1 bg-slate-800" />
      </div>

      <form className="space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6" onSubmit={handleManualCreate}>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="season-draft-name">Draft Name</label>
          <input id="season-draft-name" required maxLength={100} className="w-full" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="season-team-count">Teams</label>
            <input
              id="season-team-count"
              type="number"
              min={2}
              max={20}
              className="w-full disabled:opacity-60 disabled:cursor-not-allowed"
              value={teamCount}
              disabled={hasFranchises}
              onChange={(e) => setTeamCount(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-slate-500">Set in league settings.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="season-rounds">Rounds</label>
            <input id="season-rounds" type="number" min={1} max={30} className="w-full" value={rounds} onChange={(e) => setRounds(Number(e.target.value))} />
          </div>
        </div>

        {hasFranchises && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Franchises that will be linked</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {franchiseTeams.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-bold"
                    style={{ backgroundColor: primary + "33" }}
                  >
                    {t.logoUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={t.logoUrl} alt="" className="h-full w-full object-cover" />
                      : <span style={{ color: primary }}>{(t.shortName || t.name).slice(0, 2).toUpperCase()}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{t.name}</p>
                    {t.ownerName && <p className="truncate text-xs text-slate-400">{t.ownerName}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {error && <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={isCreating}
          className="rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: primary, color: secondary }}>
          {isCreating ? "Creating..." : "Create Season and Draft"}
        </button>
      </form>
    </div>
  );
}

const PROVIDER_LOGO_FILES: Record<string, string> = {
  "sleeper.com": "/providers/sleeper.png",
  "espn.com": "/providers/espn.png",
  "yahoo.com": "/providers/yahoo.png",
  "fleaflicker.com": "/providers/fleaflicker.png",
  "myfantasyleague.com": "/providers/mfl.png",
  "cbssports.com": "/providers/cbs.png",
  "fantrax.com": "/providers/fantrax.png",
};

function ProviderLogo({ domain, label }: { domain: string; label: string; color: string }) {
  const src = PROVIDER_LOGO_FILES[domain];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={label} width={36} height={36} className="h-9 w-9 shrink-0 rounded-xl object-cover" />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-sm font-bold">
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
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
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
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-sm text-slate-400 hover:text-white">
          ← Providers
        </button>
        <span className="text-slate-700">|</span>
        <span className="font-semibold text-white">{providerLabel[provider]}</span>
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
            className="w-full"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
          />
        </div>

        {provider === "espn" && (
          <div>
            <button
              type="button"
              className="text-sm transition-opacity hover:opacity-70"
          style={{ color: primary }}
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
                    className="w-full font-mono"
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
                    className="w-full font-mono"
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
              className="w-full"
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
            className="w-full rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-600 disabled:opacity-50 transition-colors"
          >
            {isConnecting ? "Opening Yahoo..." : "Connect Yahoo Account"}
          </button>
        )}

        {provider === "yahoo" && yahooConnected && (
          <p className="text-sm text-green-400">Yahoo account connected.</p>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: primary, color: secondary }}
        >
          {isLoading ? "Loading preview..." : "Preview Import"}
        </button>
      </form>
    </div>
  );
}
