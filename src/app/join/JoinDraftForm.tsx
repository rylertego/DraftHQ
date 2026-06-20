"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { joinDraft } from "@/lib/draftApi";
import { normalizeJoinCode } from "@/lib/participantLogic";
import { supabase } from "@/lib/supabase";

interface JoinDraftFormProps {
  initialJoinCode?: string;
}

export default function JoinDraftForm({
  initialJoinCode = "",
}: JoinDraftFormProps) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState(normalizeJoinCode(initialJoinCode));
  const [displayName, setDisplayName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user?.email) {
        setSignedInEmail(data.user.email);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) {
          setSignedInEmail(session?.user.email ?? null);
        }
      }
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = normalizeJoinCode(joinCode);

    if (normalizedCode.length < 6 || normalizedCode.length > 12) {
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
      const participant = await joinDraft(normalizedCode, displayName.trim());
      router.push(`/draft?draftId=${participant.draftId}`);
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : "Unable to join the draft."
      );
      setIsJoining(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Join Draft</h1>

      {signedInEmail && (
        <p className="mb-4 text-sm text-gray-400">
          Invitation accepted for {signedInEmail}. Your assigned team will be
          claimed when you join.
        </p>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block mb-2" htmlFor="join-code">
            Join Code
          </label>
          <input
            id="join-code"
            className="border rounded p-2 w-full uppercase"
            value={joinCode}
            maxLength={12}
            onChange={(event) =>
              setJoinCode(normalizeJoinCode(event.target.value))
            }
          />
        </div>

        <div>
          <label className="block mb-2" htmlFor="display-name">
            Display Name
          </label>
          <input
            id="display-name"
            className="border rounded p-2 w-full"
            value={displayName}
            maxLength={50}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>

        {error && <p className="text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={isJoining}
          className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded"
        >
          {isJoining ? "Joining..." : "Join Draft"}
        </button>
      </form>
    </main>
  );
}
