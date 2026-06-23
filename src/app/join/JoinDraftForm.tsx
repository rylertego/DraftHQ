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
      if (active && data.user?.email) {
        setSignedInEmail(data.user.email);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setSignedInEmail(session?.user.email ?? null);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Fetch preview whenever join code reaches valid length
  useEffect(() => {
    const code = normalizeJoinCode(joinCode);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (code.length < 6) {
      setPreview(null);
      setPreviewError("");
      return;
    }

    debounceRef.current = setTimeout(() => {
      void fetchPreview(code);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode]);

  async function fetchPreview(code: string) {
    setIsFetchingPreview(true);
    setPreviewError("");
    setPreview(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("get_draft_join_preview", {
        p_join_code: code,
      });

      if (rpcError) throw rpcError;

      setPreview(data as DraftPreview);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Draft not found. Check the join code."
      );
    } finally {
      setIsFetchingPreview(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const code = normalizeJoinCode(joinCode);

    if (code.length < 6 || code.length > 12) {
      setError("Enter a valid join code.");
      return;
    }

    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }

    setError("");
    setIsJoining(true);

    try {
      const participant = await joinDraft(code, displayName.trim());
      router.push(`/draft?draftId=${participant.draftId}`);
    } catch (joinError) {
      setError(
        joinError instanceof Error ? joinError.message : "Unable to join the draft."
      );
      setIsJoining(false);
    }
  }

  const isDraftComplete = preview?.status === "complete";

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-3xl font-bold">Join Draft</h1>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block" htmlFor="join-code">
            Join Code
          </label>
          <input
            id="join-code"
            className="w-full rounded border p-2 uppercase tracking-widest"
            value={joinCode}
            maxLength={12}
            autoComplete="off"
            onChange={(e) => setJoinCode(normalizeJoinCode(e.target.value))}
          />
        </div>

        {/* Draft preview */}
        {isFetchingPreview && (
          <p className="text-sm text-gray-400">Looking up draft...</p>
        )}

        {previewError && (
          <p className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-400">
            {previewError}
          </p>
        )}

        {preview && !previewError && (
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 space-y-1">
            <p className="font-semibold text-lg">{preview.draftName}</p>
            <p className="text-sm text-gray-400">
              {preview.teamCount} teams · {preview.rounds} rounds
            </p>

            {preview.invitedTeamName && (
              <p className="mt-2 text-sm font-medium text-green-400">
                You&apos;ve been invited to manage{" "}
                <span className="font-bold">{preview.invitedTeamName}</span>.
                {!signedInEmail && (
                  <span className="block mt-1 text-yellow-400 font-normal">
                    Sign in with your invited email address to claim this team.
                  </span>
                )}
              </p>
            )}

            {!preview.invitedTeamName && signedInEmail && (
              <p className="mt-2 text-sm text-gray-400">
                Signed in as <span className="text-white">{signedInEmail}</span>.
                You&apos;ll join without a pre-assigned team — the commissioner
                can assign you after you join.
              </p>
            )}

            {preview.alreadyJoined && (
              <p className="mt-2 text-sm text-blue-400 font-medium">
                You&apos;re already in this draft.
              </p>
            )}

            {isDraftComplete && (
              <p className="mt-2 text-sm text-yellow-400">This draft is complete.</p>
            )}
          </div>
        )}

        <div>
          <label className="mb-2 block" htmlFor="display-name">
            Your Display Name
          </label>
          <input
            id="display-name"
            className="w-full rounded border p-2"
            value={displayName}
            maxLength={50}
            placeholder="How you'll appear in the draft room"
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        {error && <p className="text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={isJoining || isDraftComplete || !!previewError}
          className="w-full rounded bg-blue-600 px-4 py-2 font-semibold disabled:opacity-50"
        >
          {isJoining
            ? "Joining..."
            : preview?.alreadyJoined
            ? "Rejoin Draft"
            : "Join Draft"}
        </button>
      </form>
    </main>
  );
}
