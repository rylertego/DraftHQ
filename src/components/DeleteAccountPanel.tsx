"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Account deletion is irreversible and cannot be undone by a commissioner, so
// it asks for typed confirmation rather than a single click. The phrase is
// deliberately not "yes" — it should be impossible to do by reflex.

const CONFIRM_PHRASE = "DELETE";

export default function DeleteAccountPanel() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_PHRASE && !isDeleting;

  async function handleDelete() {
    setError("");
    setIsDeleting(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setError("Your session has expired. Sign in again.");
        return;
      }

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Could not delete your account.");
        return;
      }

      // The account is gone; the local session is now a token for a user that
      // no longer exists. Clear it before leaving so nothing tries to reuse it.
      await supabase.auth.signOut();
      router.replace("/?deleted=1");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-red-900/60 bg-red-950/10 p-6 sm:p-8">
      <h2 className="mb-1 text-lg font-bold text-white">Delete Account</h2>
      <p className="text-sm leading-6 text-slate-400">
        Permanently deletes your login, profile, and league memberships, and releases any
        teams you own so your commissioner can reassign them. Picks you already made stay
        in each draft&apos;s history. This cannot be undone.
      </p>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-5 rounded-xl border border-red-800 bg-transparent px-5 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-950/40 hover:text-red-300"
        >
          Delete Account
        </button>
      ) : (
        <div className="mt-5 space-y-3">
          <label htmlFor="confirm-delete" className="block text-sm text-slate-300">
            Type <span className="font-bold text-white">{CONFIRM_PHRASE}</span> to confirm.
          </label>
          <input
            id="confirm-delete"
            type="text"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
            className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
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
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? "Deleting..." : "Permanently Delete"}
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => {
                setIsOpen(false);
                setConfirmText("");
                setError("");
              }}
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
