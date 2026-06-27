"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { createDraftForSeason, resetSeasonDraft } from "@/lib/leagueApi";
import type { LeagueSeason } from "@/types/league";

function ResetDraftModal({ seasonId, onClose, onReset }: { seasonId: string; onClose: () => void; onReset: () => void }) {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useState(() => { setTimeout(() => inputRef.current?.focus(), 50); });

  async function handleReset() {
    if (confirm !== "RESET") return;
    setIsResetting(true);
    setError("");
    try {
      await resetSeasonDraft(seasonId);
      onReset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reset draft.");
      setIsResetting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-950/60">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 16 16" fill="none">
              <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 3v3M8 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-white">Reset Draft?</h2>
            <p className="mt-1 text-sm text-slate-400">
              This will permanently delete the draft and all its picks. The season will return to "no draft" state. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Type <span className="font-mono text-red-400">RESET</span> to confirm
          </label>
          <input
            ref={inputRef}
            type="text"
            maxLength={10}
            className="w-full"
            placeholder="RESET"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") void handleReset(); }}
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} disabled={isResetting}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => void handleReset()} disabled={confirm !== "RESET" || isResetting}
            className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {isResetting ? "Resetting..." : "Delete Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateDraftModal({
  season,
  leagueId,
  maxTeams,
  onClose,
  onCreated,
}: {
  season: LeagueSeason;
  leagueId: string;
  maxTeams: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const currentYear = season.year;
  const [draftName, setDraftName] = useState(`${currentYear} Draft`);
  const [teamCount, setTeamCount] = useState(maxTeams);
  const [rounds, setRounds] = useState(15);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTeamCount(maxTeams);
  }, [maxTeams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setError("");
    try {
      await createDraftForSeason({
        seasonId: season.id,
        draftName,
        teamCount,
        rounds,
      });
      onCreated();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Unable to create draft.";
      setError(msg);
      setIsCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-5 text-base font-bold text-white">Create Draft — {season.name}</h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Draft Name</label>
            <input required maxLength={100} className="w-full" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Teams</label>
              <input
                type="number" min={2} max={20}
                className="w-full disabled:opacity-60 disabled:cursor-not-allowed"
                value={teamCount}
                disabled
                onChange={(e) => setTeamCount(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-slate-500">Set in league settings.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Rounds</label>
              <input type="number" min={1} max={30} className="w-full" value={rounds} onChange={(e) => setRounds(Number(e.target.value))} />
            </div>
          </div>
          {error && <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isCreating} className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90" style={{ backgroundColor: primary, color: secondary }}>
              {isCreating ? "Creating..." : "Create Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SeasonStatusBadge({ status }: { status: LeagueSeason["status"] }) {
  const map: Record<LeagueSeason["status"], string> = {
    complete: "bg-slate-700 text-slate-300",
    active: "bg-teal-900/60 text-teal-300",
    drafting: "bg-yellow-900/60 text-yellow-300",
    upcoming: "bg-slate-800 text-slate-400",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

export default function LeagueHome({ slug }: { slug: string }) {
  const { workspace, reload } = useWorkspace();
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [showReset, setShowReset] = useState(false);
  const [showCreateDraft, setShowCreateDraft] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);

  if (!workspace) return null;

  const [currentSeason, ...pastSeasons] = workspace.seasons;
  const draft = currentSeason?.draft;
  const draftIsLive = draft?.status === "active" || draft?.status === "paused";

  return (
    <>
      {/* Current Season */}
      <section className="rounded-2xl border p-6 bg-slate-900" style={{ borderColor: primary + "55" }}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-white">
            {currentSeason ? currentSeason.name : `${new Date().getFullYear()} Season`}
          </h2>
          <div className="flex items-center gap-4">
            {currentSeason && <SeasonStatusBadge status={currentSeason.status} />}
            {workspace.canManage && draft && (
              <button type="button" onClick={() => setShowReset(true)}
                className="text-sm font-medium text-red-500 hover:text-red-400 transition-colors">
                Reset Draft
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!currentSeason && (
            <p className="text-sm text-slate-400">No season yet.</p>
          )}

          {currentSeason && !draft && workspace.canManage && (
            <button
              type="button"
              onClick={() => setShowCreateDraft(true)}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: primary, color: secondary }}
            >
              Create Draft
            </button>
          )}

          {draft && (
            <>
              <Link
                href={draftIsLive ? `/draft?draftId=${draft.id}&leagueSlug=${slug}` : `/teams?draftId=${draft.id}&tab=settings&leagueSlug=${slug}`}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
                style={{ backgroundColor: primary, color: secondary }}
              >
                {draftIsLive ? "Enter Draft Room" : "Configure Draft"}
              </Link>
              {!draftIsLive && draft.status === "setup" && (
                <Link
                  href={`/draft?draftId=${draft.id}&leagueSlug=${slug}`}
                  className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ borderColor: primary, color: primary, backgroundColor: `${secondary}33` }}
                >
                  Pre-Draft Lobby
                </Link>
              )}
              {!draftIsLive && draft.scheduledAt && (
                <span className="text-sm text-slate-400">
                  Draft on{" "}
                  <span className="font-semibold text-white">
                    {new Date(draft.scheduledAt).toLocaleDateString(undefined, {
                      weekday: "short", month: "short", day: "numeric", year: "numeric",
                    })}
                  </span>
                </span>
              )}
            </>
          )}
        </div>
      </section>

      {/* Past Seasons — collapsible */}
      {pastSeasons.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setPastOpen((o) => !o)}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-800/40"
          >
            <span className="text-sm font-semibold text-slate-400">
              Past Seasons <span className="ml-1.5 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">{pastSeasons.length}</span>
            </span>
            <svg
              className={`h-4 w-4 text-slate-500 transition-transform ${pastOpen ? "rotate-180" : ""}`}
              viewBox="0 0 16 16" fill="none"
            >
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {pastOpen && (
            <div className="border-t border-slate-800 divide-y divide-slate-800">
              {pastSeasons.map((season) => (
                <div key={season.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-slate-400">
                      {season.year}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{season.name}</p>
                      <p className="text-xs text-slate-500">{workspace.members.length} members</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <SeasonStatusBadge status={season.status} />
                    {season.draft && (
                      <Link href={`/draft?draftId=${season.draft.id}`}
                        className="text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors whitespace-nowrap">
                        View Draft →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showReset && currentSeason && (
        <ResetDraftModal seasonId={currentSeason.id} onClose={() => setShowReset(false)} onReset={reload} />
      )}

      {showCreateDraft && currentSeason && (
        <CreateDraftModal
          season={currentSeason}
          leagueId={workspace.league.id}
          maxTeams={workspace.league.teamCount}
          onClose={() => setShowCreateDraft(false)}
          onCreated={reload}
        />
      )}
    </>
  );
}
