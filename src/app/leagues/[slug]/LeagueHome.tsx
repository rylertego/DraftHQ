"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LeagueCommandCenter from "@/components/LeagueCommandCenter";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { createDraftForSeason, resetSeasonDraft } from "@/lib/leagueApi";
import type { LeagueSeason } from "@/types/league";

function ResetDraftModal({ seasonId, onClose, onReset }: { seasonId: string; onClose: () => void; onReset: () => void }) {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

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
              This will permanently delete the draft and all its picks. The season will return to &quot;no draft&quot; state. This cannot be undone.
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
  maxTeams,
  onClose,
  onCreated,
}: {
  season: LeagueSeason;
  maxTeams: number;
  onClose: () => void;
  onCreated: (draftId: string) => void;
}) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const currentYear = season.year;
  const [draftName, setDraftName] = useState(`${currentYear} Draft`);
  const [teamCount, setTeamCount] = useState(maxTeams);
  const [rounds, setRounds] = useState(15);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setError("");
    try {
      const createdSeason = await createDraftForSeason({
        seasonId: season.id,
        draftName,
        teamCount,
        rounds,
      });
      if (!createdSeason.draftId) throw new Error("The season was created without a draft.");
      onCreated(createdSeason.draftId);
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
        <h2 className="mb-5 text-base font-bold text-white">Create Draft â€” {season.name}</h2>
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

export default function LeagueHome({ slug }: { slug: string }) {
  const router = useRouter();
  const { workspace, isLoading, error, reload } = useWorkspace();
  const [showReset, setShowReset] = useState(false);
  const [showCreateDraft, setShowCreateDraft] = useState(false);

  if (isLoading && !workspace) {
    return (
      <div className="space-y-6" aria-label="Loading league dashboard">
        <div className="h-56 animate-pulse rounded-2xl bg-slate-900" />
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-slate-900" />)}
        </div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="rounded-2xl border border-red-800 bg-red-950/30 p-6">
        <h1 className="font-bold text-red-300">Unable to load league dashboard</h1>
        <p className="mt-2 text-sm text-red-400">{error || "League not found."}</p>
        <button type="button" onClick={reload} className="mt-4 rounded-xl border border-red-800 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/50">
          Try again
        </button>
      </div>
    );
  }

  const currentSeason = workspace.seasons[0];

  return (
    <>
      <LeagueCommandCenter
        workspace={workspace}
        slug={slug}
        onConfigureDraft={() => setShowCreateDraft(true)}
        onResetDraft={() => setShowReset(true)}
      />

      {showReset && currentSeason && (
        <ResetDraftModal seasonId={currentSeason.id} onClose={() => setShowReset(false)} onReset={reload} />
      )}

      {showCreateDraft && currentSeason && (
        <CreateDraftModal
          season={currentSeason}
          maxTeams={workspace.league.teamCount}
          onClose={() => setShowCreateDraft(false)}
          onCreated={(draftId) => router.push(`/teams?draftId=${draftId}&tab=settings&leagueSlug=${slug}`)}
        />
      )}
    </>
  );
}
