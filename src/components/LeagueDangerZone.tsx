"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteLeague } from "@/lib/leagueApi";

// Deleting a league removes it for everyone in it, not just the person
// clicking, so this asks for the league's own name rather than a generic
// confirmation word. Typing "DELETE" is muscle memory; typing the league name
// is not, and it also makes it impossible to delete the wrong league from the
// wrong tab.
//
// Owner-only, matching delete_league(): the RPC raises 42501 for anyone else,
// so showing this to a co-commissioner would only offer them a guaranteed
// error.

interface LeagueDangerZoneProps {
  leagueId: string;
  leagueName: string;
}

export default function LeagueDangerZone({ leagueId, leagueName }: LeagueDangerZoneProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const canDelete = confirmText.trim() === leagueName.trim() && !isDeleting;

  async function handleDelete() {
    setError("");
    setIsDeleting(true);
    try {
      await deleteLeague(leagueId);
      router.replace("/dashboard");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this league.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-900/60 bg-red-950/10 p-4">
      <h2 className="text-base font-bold text-white">Delete League</h2>
      <p className="mt-1 text-sm leading-6 text-slate-400">
        Permanently deletes <span className="font-semibold text-white">{leagueName}</span> for
        every member — its teams, seasons, drafts, and history. This cannot be undone.
      </p>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-4 rounded-xl border border-red-800 px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-950/40 hover:text-red-300"
        >
          Delete League
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label htmlFor="confirm-delete-league" className="block text-sm text-slate-300">
            Type <span className="font-bold text-white">{leagueName}</span> to confirm.
          </label>
          <input
            id="confirm-delete-league"
            type="text"
            value={confirmText}
            autoComplete="off"
            onChange={(event) => setConfirmText(event.target.value)}
            className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />

          {error && (
            <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canDelete}
              onClick={() => void handleDelete()}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? "Deleting..." : "Permanently Delete"}
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => { setIsOpen(false); setConfirmText(""); setError(""); }}
              className="text-sm font-semibold text-slate-400 transition-colors hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
