"use client";

import { useEffect, useRef, useState } from "react";

export default function ResetDraftModal({
  onClose,
  onConfirm,
  onReset,
}: {
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onReset: () => void;
}) {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleReset() {
    if (confirmation !== "RESET") return;
    setIsResetting(true);
    setError("");
    try {
      await onConfirm();
      onReset();
      onClose();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset draft.");
      setIsResetting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-950/60">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 16 16" fill="none">
              <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 3v3M8 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-white">Reset Draft?</h2>
            <p className="mt-1 text-sm text-slate-400">
              This clears every pick and returns the draft to pre-draft setup. The draft and its settings page will remain available. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Type <span className="font-mono text-red-400">RESET</span> to confirm
          </label>
          <input ref={inputRef} type="text" maxLength={10} className="w-full" placeholder="RESET" value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") void handleReset(); }} />
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} disabled={isResetting} className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors">Cancel</button>
          <button type="button" onClick={() => void handleReset()} disabled={confirmation !== "RESET" || isResetting} className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors">
            {isResetting ? "Resetting..." : "Reset Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
