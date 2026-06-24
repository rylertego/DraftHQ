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
    const finish = (hasPersistent: boolean) => {
      if (active) { setHasAccount(hasPersistent); setIsCheckingAccount(false); }
    };
    const timeoutId = window.setTimeout(() => finish(false), ACCOUNT_CHECK_TIMEOUT_MS);
    void supabase.auth.getSession()
      .then(({ data }) => { window.clearTimeout(timeoutId); finish(Boolean(data.session?.user && !data.session.user.is_anonymous)); })
      .catch(() => { window.clearTimeout(timeoutId); finish(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      window.clearTimeout(timeoutId); finish(Boolean(session?.user && !session.user.is_anonymous));
    });
    return () => { active = false; window.clearTimeout(timeoutId); listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (isCheckingAccount || !hasAccount) return;
    let active = true;
    void getMyCommissionerLeagues()
      .then((l) => { if (active) setLeagues(l); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Unable to load your leagues."); });
    return () => { active = false; };
  }, [hasAccount, isCheckingAccount]);

  async function handleCreateDraft() {
    if (!draftName.trim()) { setError("Draft name is required."); return; }
    if (teamCount < 2 || teamCount > 20) { setError("Team count must be between 2 and 20."); return; }
    if (rounds < 1 || rounds > 30) { setError("Rounds must be between 1 and 30."); return; }
    setError("");
    setIsCreating(true);
    try {
      const draft = await createDraft({ name: draftName.trim(), teamCount, rounds, leagueId: leagueId || undefined });
      router.push(`/teams?draftId=${draft.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create the draft.");
      setIsCreating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Create Draft</h1>
        <p className="mt-1 text-sm text-slate-400">Set up your draft room in seconds.</p>
      </div>

      {isCheckingAccount ? (
        <p className="text-slate-400">Checking your account...</p>
      ) : !hasAccount ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <h2 className="mb-2 text-xl font-bold text-white">Commissioner account required</h2>
          <p className="mb-6 text-sm text-slate-400">
            Create an account or log in to create and manage a draft. Owners can join without an account.
          </p>
          <div className="flex gap-3">
            <Link href="/signup" className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-400 transition-colors">
              Create Account
            </Link>
            <Link href="/login" className="rounded-xl border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
              Log In
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <SleeperImportForm />

          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <span className="h-px flex-1 bg-slate-800" />
            Or create manually
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-5">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="draft-league">
                  League (optional)
                </label>
                <Link className="text-xs font-medium text-teal-400 hover:text-teal-300" href="/leagues/new">
                  + Create a league
                </Link>
              </div>
              <select id="draft-league" className="w-full" value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
                <option value="">Standalone draft</option>
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>{league.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="draft-name">
                Draft Name
              </label>
              <input id="draft-name" className="w-full" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="team-count">
                  Teams
                </label>
                <input id="team-count" type="number" min={2} max={20} className="w-full" value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="round-count">
                  Rounds
                </label>
                <input id="round-count" type="number" min={1} max={30} className="w-full" value={rounds} onChange={(e) => setRounds(Number(e.target.value))} />
              </div>
            </div>

            {error && <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>}

            <div className="flex items-center justify-between">
              <button
                onClick={handleCreateDraft}
                disabled={isCreating}
                className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-colors"
              >
                {isCreating ? "Creating..." : "Create Draft"}
              </button>
              <Link className="text-sm text-teal-400 hover:text-teal-300" href="/join">
                Have a code? Join →
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
