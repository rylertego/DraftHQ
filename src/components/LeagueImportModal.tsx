"use client";

import { FormEvent, useState } from "react";
import { getSleeperLeaguePreview } from "@/lib/draftApi";
import { importLeagueTeams, type LeagueImportProvider } from "@/lib/leagueApi";
import {
  getEspnLeaguePreview,
  getYahooAuthUrl,
  getYahooLeaguePreview,
} from "@/lib/providerApi";
import type { ProviderLeaguePreview } from "@/lib/providers/types";
import { Alert, Button, Dialog, Field, Input } from "@/components/ui";

type Provider = LeagueImportProvider;

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
  onImported: (count: number, provider: LeagueImportProvider) => Promise<void> | void;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      size="large"
      title="Import League"
      description="Choose a provider and preview teams before importing."
    >
      <LeagueImportFlow
        leagueId={leagueId}
        availableSlots={availableSlots}
        onCancel={onClose}
        onImported={onImported}
      />
    </Dialog>
  );
}

export function LeagueImportFlow({
  leagueId,
  availableSlots,
  onCancel,
  onImported,
}: {
  leagueId: string;
  availableSlots: number;
  onCancel?: () => void;
  onImported: (count: number, provider: LeagueImportProvider) => Promise<void> | void;
}) {
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
          if (failure) {
            reject(failure);
            return;
          }
          resolve();
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
    if (!preview || !provider) return;
    setError("");
    setLoading(true);
    try {
      await importLeagueTeams(
        leagueId,
        preview.teams.map((team) => ({ name: team.name, ownerName: team.ownerName })),
        provider
      );
      await onImported(preview.teams.length, provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import teams.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-5)]">
      {!provider && (
        <div className="grid gap-[var(--space-3)] sm:grid-cols-3">
          {PROVIDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setProvider(item.id)}
              className="rounded-[var(--radius-surface)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] p-[var(--space-3)] text-left transition-colors hover:border-[color:var(--color-border-strong)] hover:bg-[var(--color-surface-3)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.logo} alt="" className="mb-[var(--space-2)] h-10 w-10 rounded-xl object-cover" />
              <p className="font-bold text-[color:var(--color-text-primary)]">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[color:var(--color-text-secondary)]">
                {item.description}
              </p>
            </button>
          ))}
        </div>
      )}

      {provider && !preview && (
        <form
          id="import-league-form"
          onSubmit={(event) => void loadPreview(event)}
          className="flex flex-col gap-[var(--space-4)]"
        >
          <div>
            <Button variant="tertiary" onClick={resetProvider} disabled={loading}>
              ← Providers
            </Button>
          </div>

          {provider === "yahoo" && (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={loading || yahooConnected}
              onClick={() => void connectYahoo()}
            >
              {yahooConnected ? "Yahoo account connected" : loading ? "Connecting..." : "Connect Yahoo Account"}
            </Button>
          )}

          <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
            <div className={provider === "sleeper" || provider === "yahoo" ? "sm:col-span-2" : ""}>
              <Field
                label={provider === "yahoo" ? "League Key" : "League ID"}
                controlId="import-league-key"
              >
                <Input
                  required
                  inputMode={provider === "yahoo" ? "text" : "numeric"}
                  placeholder={provider === "yahoo" ? "423.l.123456" : "Numeric league ID"}
                  value={leagueKey}
                  onChange={(event) => setLeagueKey(event.target.value)}
                />
              </Field>
            </div>
            {provider === "espn" && (
              <Field label="Season Year" controlId="import-season-year">
                <Input
                  required
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                />
              </Field>
            )}
          </div>

          {provider === "espn" && (
            <div>
              <Button variant="tertiary" onClick={() => setShowPrivate((value) => !value)}>
                {showPrivate ? "Hide private league cookies" : "Private league? Add cookies"}
              </Button>
              {showPrivate && (
                <div className="mt-[var(--space-3)] grid gap-[var(--space-3)] sm:grid-cols-2">
                  <Field label="espn_s2 cookie" controlId="import-espn-s2">
                    <Input
                      type="password"
                      placeholder="espn_s2"
                      value={espnS2}
                      onChange={(event) => setEspnS2(event.target.value)}
                    />
                  </Field>
                  <Field label="SWID cookie" controlId="import-espn-swid">
                    <Input
                      type="password"
                      placeholder="SWID"
                      value={swid}
                      onChange={(event) => setSwid(event.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {error && <Alert status="danger">{error}</Alert>}

          <div className="flex justify-end">
            <Button
              type="submit"
              scope="league"
              loading={loading}
              disabled={provider === "yahoo" && !yahooConnected}
            >
              {loading ? "Loading preview..." : "Preview Import"}
            </Button>
          </div>
        </form>
      )}

      {preview && (
        <div className="flex flex-col gap-[var(--space-4)]">
          <div>
            <Button
              variant="tertiary"
              onClick={() => { setPreview(null); setError(""); }}
              disabled={loading}
            >
              ← Back
            </Button>
          </div>

          <div>
            <h3 className="font-bold text-[color:var(--color-text-primary)]">{preview.leagueName}</h3>
            <p className="text-sm text-[color:var(--color-text-secondary)]">
              {preview.teams.length} teams will be added.
            </p>
          </div>

          {preview.warnings.map((warning) => (
            <Alert key={warning} status="warning">{warning}</Alert>
          ))}

          {/* Plain rows, not cards: this list already sits inside the dialog
              surface and nesting a third card deep reads as clutter. */}
          <div className="grid max-h-72 gap-[var(--space-2)] overflow-y-auto pr-1 sm:grid-cols-2">
            {preview.teams.map((team, index) => (
              <div
                key={`${team.name}-${index}`}
                className="rounded-[var(--radius-control)] border border-[color:var(--color-border-subtle)] px-[var(--space-3)] py-2"
              >
                <p className="truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
                  {team.name}
                </p>
                <p className="truncate text-xs text-[color:var(--color-text-secondary)]">
                  {team.ownerName || "Owner not provided"}
                </p>
              </div>
            ))}
          </div>

          {error && <Alert status="danger">{error}</Alert>}

          <div className="flex flex-wrap justify-end gap-[var(--space-3)]">
            {onCancel && (
              <Button variant="secondary" onClick={onCancel} disabled={loading}>
                Cancel
              </Button>
            )}
            <Button scope="league" loading={loading} onClick={() => void confirmImport()}>
              {loading ? "Importing teams..." : `Import ${preview.teams.length} Teams`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
