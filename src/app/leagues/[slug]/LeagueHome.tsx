"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import LeagueWorkspaceHeader from "@/components/LeagueWorkspaceHeader";
import { useLeagueWorkspace } from "@/hooks/useLeagueWorkspace";
import { resetDraft } from "@/lib/draftApi";
import type { LeagueSeason } from "@/types/league";

function ResetDraftModal({ draftId, onClose, onReset }: { draftId: string; onClose: () => void; onReset: () => void }) {
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
      await resetDraft(draftId);
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-950/60">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 16 16" fill="none">
              <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 3v3M8 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-white">Reset Draft?</h2>
            <p className="mt-1 text-sm text-slate-400">
              This will delete all picks and return the draft to setup status. Team names and settings are preserved. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Type <span className="font-mono text-yellow-400">RESET</span> to confirm
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
            className="flex-1 rounded-xl bg-yellow-600 py-2.5 text-sm font-semibold text-white hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {isResetting ? "Resetting..." : "Reset Draft"}
          </button>
        </div>
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
  const { workspace, error, isLoading, reload } = useLeagueWorkspace(slug);
  const [showReset, setShowReset] = useState(false);

  if (isLoading) return <main className="w-full p-8 text-slate-400">Loading league...</main>;
  if (error || !workspace) return <main className="w-full p-8 text-red-400">{error || "League not found."}</main>;

  const [currentSeason, ...pastSeasons] = workspace.seasons;
  const draft = currentSeason?.draft;
  const draftIsLive = draft?.status === "active" || draft?.status === "paused";

  return (
    <main className="w-full space-y-6 px-6 py-8">
      <LeagueWorkspaceHeader league={workspace.league} canManage={workspace.canManage} />

      {/* Current Season */}
      <section className={`rounded-2xl border p-6 ${draftIsLive ? "border-teal-700 bg-teal-950/20" : "border-slate-700 bg-slate-900"}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-white">
            {currentSeason ? currentSeason.name : `${new Date().getFullYear()} Season`}
          </h2>
          <div className="flex items-center gap-4">
            {currentSeason && <SeasonStatusBadge status={currentSeason.status} />}
            {workspace.canManage && draft && (
              <button type="button" onClick={() => setShowReset(true)}
                className="text-sm font-medium text-yellow-500 hover:text-yellow-400 transition-colors">
                Reset Draft
              </button>
            )}
          </div>
        </div>
        {draft && (
          <Link
            href={draftIsLive ? `/draft?draftId=${draft.id}` : `/teams?draftId=${draft.id}&tab=settings&leagueSlug=${slug}`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-400 transition-colors"
          >
            {draftIsLive ? "Enter Draft Room" : `Enter ${currentSeason?.year ?? new Date().getFullYear()} Season`}
          </Link>
        )}
        {!currentSeason && (
          <p className="mt-3 text-sm text-slate-400">No season has been created yet.</p>
        )}
      </section>

      {/* Past Seasons */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white">Past Seasons</h2>
        {pastSeasons.length === 0 ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-900/40 px-6 py-8 text-center text-sm text-slate-500">
            No previous seasons yet.
          </p>
        ) : (
          pastSeasons.map((season) => (
            <article key={season.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-slate-400">
                  {season.year}
                </div>
                <div>
                  <p className="font-semibold text-white">{season.name}</p>
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
            </article>
          ))
        )}
      </section>

      {showReset && draft && (
        <ResetDraftModal draftId={draft.id} onClose={() => setShowReset(false)} onReset={reload} />
      )}
    </main>
  );
}
