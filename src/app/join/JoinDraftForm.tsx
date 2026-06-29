"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { joinDraft } from "@/lib/draftApi";
import { normalizeJoinCode } from "@/lib/participantLogic";
import { supabase } from "@/lib/supabase";

interface DraftPreview {
  draftName: string;
  teamCount: number;
  rounds: number;
  joinCode: string;
  status: string;
  invitedTeamName: string | null;
  alreadyJoined: boolean;
}

interface JoinDraftFormProps {
  initialJoinCode?: string;
}

export default function JoinDraftForm({ initialJoinCode = "" }: JoinDraftFormProps) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState(normalizeJoinCode(initialJoinCode));
  const [displayName, setDisplayName] = useState("");
  const [preview, setPreview] = useState<DraftPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user?.email) setSignedInEmail(data.user.email);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active) setSignedInEmail(session?.user.email ?? null);
    });
    return () => { active = false; authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const code = normalizeJoinCode(joinCode);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (code.length < 6) { setPreview(null); setPreviewError(""); return; }
    debounceRef.current = setTimeout(() => { void fetchPreview(code); }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode]);

  async function fetchPreview(code: string) {
    setIsFetchingPreview(true);
    setPreviewError("");
    setPreview(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_draft_join_preview", { p_join_code: code });
      if (rpcError) throw rpcError;
      setPreview(data as DraftPreview);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Draft not found. Check the join code.");
    } finally {
      setIsFetchingPreview(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeJoinCode(joinCode);
    if (code.length < 6 || code.length > 12) { setError("Enter a valid join code."); return; }
    if (!displayName.trim()) { setError("Display name is required."); return; }
    setError("");
    setIsJoining(true);
    try {
      const participant = await joinDraft(code, displayName.trim());
      router.push(`/draft/lobby?draftId=${participant.draftId}`);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join the draft.");
      setIsJoining(false);
    }
  }

  const isDraftComplete = preview?.status === "complete";

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Join Draft</h1>
          <p className="mt-2 text-slate-400">Enter your invite code to claim your seat.</p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="join-code">
                Join Code
              </label>
              <input
                id="join-code"
                className="w-full text-center font-mono text-lg uppercase tracking-[0.3em]"
                value={joinCode}
                maxLength={12}
                autoComplete="off"
                onChange={(e) => setJoinCode(normalizeJoinCode(e.target.value))}
              />
            </div>

            {isFetchingPreview && (
              <p className="text-center text-sm text-slate-500">Looking up draft...</p>
            )}

            {previewError && (
              <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">
                {previewError}
              </p>
            )}

            {preview && !previewError && (
              <div className="rounded-xl border border-slate-600 bg-slate-800/50 p-4 space-y-1.5">
                <p className="font-bold text-white">{preview.draftName}</p>
                <p className="text-sm text-slate-400">{preview.teamCount} teams · {preview.rounds} rounds</p>
                {preview.invitedTeamName && (
                  <p className="mt-2 text-sm font-medium text-teal-400">
                    Invited to manage <span className="font-bold text-white">{preview.invitedTeamName}</span>.
                    {!signedInEmail && (
                      <span className="mt-1 block font-normal text-yellow-400">
                        Sign in with your invited email to claim this team.
                      </span>
                    )}
                  </p>
                )}
                {!preview.invitedTeamName && signedInEmail && (
                  <p className="mt-2 text-sm text-slate-400">
                    Signed in as <span className="text-white">{signedInEmail}</span>.
                  </p>
                )}
                {preview.alreadyJoined && (
                  <p className="mt-2 text-sm font-medium text-teal-400">You&apos;re already in this draft.</p>
                )}
                {isDraftComplete && (
                  <p className="mt-2 text-sm text-yellow-400">This draft is complete.</p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="display-name">
                Your Display Name
              </label>
              <input
                id="display-name"
                className="w-full"
                value={displayName}
                maxLength={50}
                placeholder="How you'll appear in the draft room"
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {error && <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={isJoining || isDraftComplete || !!previewError}
              className="w-full rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-colors"
            >
              {isJoining ? "Joining..." : preview?.alreadyJoined ? "Rejoin Draft" : "Join Draft"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
