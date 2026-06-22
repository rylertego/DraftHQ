"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createDraft } from "@/lib/draftApi";
import { getMyCommissionerLeagues } from "@/lib/leagueApi";
import { supabase } from "@/lib/supabase";
import SleeperImportForm from "@/components/SleeperImportForm";
import type { League } from "@/types/league";

const ACCOUNT_CHECK_TIMEOUT_MS = 3_000;

export default function CreateDraftPage() {
  const router = useRouter();

  const [draftName, setDraftName] = useState("");
  const [teamCount, setTeamCount] = useState(12);
  const [rounds, setRounds] = useState(15);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState(true);
  const [hasAccount, setHasAccount] = useState(false);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueId, setLeagueId] = useState("");

  useEffect(() => {
    let active = true;
    const finishAccountCheck = (hasPersistentAccount: boolean) => {
      if (active) {
        setHasAccount(hasPersistentAccount);
        setIsCheckingAccount(false);
      }
    };
    const timeoutId = window.setTimeout(
      () => finishAccountCheck(false),
      ACCOUNT_CHECK_TIMEOUT_MS
    );

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        window.clearTimeout(timeoutId);
        finishAccountCheck(
          Boolean(data.session?.user && !data.session.user.is_anonymous)
        );
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        finishAccountCheck(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        window.clearTimeout(timeoutId);
        finishAccountCheck(
          Boolean(session?.user && !session.user.is_anonymous)
        );
      }
    );

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isCheckingAccount || !hasAccount) return;

    let active = true;
    void getMyCommissionerLeagues()
      .then((availableLeagues) => {
        if (active) setLeagues(availableLeagues);
      })
      .catch((leagueError) => {
        if (active) {
          setError(
            leagueError instanceof Error
              ? leagueError.message
              : "Unable to load your leagues."
          );
        }
      });

    return () => {
      active = false;
    };
  }, [hasAccount, isCheckingAccount]);

  async function handleCreateDraft() {
    if (!draftName.trim()) {
      setError("Draft name is required.");
      return;
    }

    if (teamCount < 2 || teamCount > 20) {
      setError("Team count must be between 2 and 20.");
      return;
    }

    if (rounds < 1 || rounds > 30) {
      setError("Rounds must be between 1 and 30.");
      return;
    }

    setError("");
    setIsCreating(true);

    try {
      const draft = await createDraft({
        name: draftName.trim(),
        teamCount,
        rounds,
        leagueId: leagueId || undefined,
      });

      router.push(`/teams?draftId=${draft.id}`);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create the draft."
      );
      setIsCreating(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Create Draft</h1>

      {isCheckingAccount ? (
        <p className="text-gray-400">Checking your account...</p>
      ) : !hasAccount ? (
        <section className="rounded border border-gray-700 p-6">
          <h2 className="mb-2 text-xl font-bold">
            Commissioner account required
          </h2>
          <p className="mb-4 text-gray-400">
            Create an account or log in to create and manage a draft. Owners
            can still join drafts without creating an account first.
          </p>
          <div className="flex gap-3">
            <Link
              className="rounded bg-blue-600 px-4 py-2 text-white"
              href="/signup"
            >
              Create Account
            </Link>
            <Link
              className="rounded bg-gray-700 px-4 py-2 text-white"
              href="/login"
            >
              Log In
            </Link>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          <SleeperImportForm />

          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="h-px flex-1 bg-gray-800" />
            Or create manually
            <span className="h-px flex-1 bg-gray-800" />
          </div>

          <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="draft-league">League (optional)</label>
              <Link className="text-sm text-blue-400 underline" href="/leagues/new">
                Create a league
              </Link>
            </div>
            <select
              id="draft-league"
              className="w-full rounded border bg-gray-900 p-2"
              value={leagueId}
              onChange={(event) => setLeagueId(event.target.value)}
            >
              <option value="">Standalone draft</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2" htmlFor="draft-name">
              Draft Name
            </label>
            <input
              id="draft-name"
              className="border rounded p-2 w-full"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-2" htmlFor="team-count">
              Number of Teams
            </label>
            <input
              id="team-count"
              type="number"
              min={2}
              max={20}
              className="border rounded p-2 w-full"
              value={teamCount}
              onChange={(e) => setTeamCount(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block mb-2" htmlFor="round-count">
              Number of Rounds
            </label>
            <input
              id="round-count"
              type="number"
              min={1}
              max={30}
              className="border rounded p-2 w-full"
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
            />
          </div>

          {error && <p className="text-red-500">{error}</p>}

          <button
            onClick={handleCreateDraft}
            disabled={isCreating}
            className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded"
          >
            {isCreating ? "Creating..." : "Create Draft"}
          </button>

          <p className="text-sm text-gray-400">
            Have a code?{" "}
            <Link className="text-blue-400 underline" href="/join">
              Join an existing draft
            </Link>
          </p>
          </div>
        </div>
      )}
    </main>
  );
}
