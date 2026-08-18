"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createDraft } from "@/lib/draftApi";
import { getMyCommissionerLeagues } from "@/lib/leagueApi";
import { supabase } from "@/lib/supabase";
import SleeperImportForm from "@/components/SleeperImportForm";
import type { League } from "@/types/league";
import {
  Alert,
  Button,
  Field,
  FormLayout,
  Input,
  LinkButton,
  PageHeader,
  PageShell,
  Panel,
  Select,
} from "@/components/ui";

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
    <PageShell width="readable">
      <PageHeader title="Create Draft" description="Set up your draft room in seconds." />

      <div className="mt-[var(--space-6)] flex flex-col gap-[var(--space-5)]">
        {isCheckingAccount ? (
          <p className="text-[color:var(--color-text-secondary)]">Checking your account...</p>
        ) : !hasAccount ? (
          <Panel
            title="Commissioner account required"
            description="Create an account or log in to create and manage a draft. Owners can join without an account."
          >
            <div className="flex flex-wrap gap-[var(--density-control-gap)]">
              <LinkButton href="/signup" variant="primary" scope="product">
                Create Account
              </LinkButton>
              <LinkButton href="/login" variant="secondary" scope="product">
                Log In
              </LinkButton>
            </div>
          </Panel>
        ) : (
          <>
            <SleeperImportForm />

            <div className="flex items-center gap-[var(--space-3)] text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
              <span className="h-px flex-1 bg-[var(--color-border-subtle)]" />
              Or create manually
              <span className="h-px flex-1 bg-[var(--color-border-subtle)]" />
            </div>

            <Panel>
              <FormLayout
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreateDraft();
                }}
                actions={
                  <>
                    <Button type="submit" loading={isCreating}>
                      {isCreating ? "Creating..." : "Create Draft"}
                    </Button>
                    <LinkButton href="/join" variant="tertiary" scope="product">
                      Have a code? Join →
                    </LinkButton>
                  </>
                }
              >
                <Field
                  label="League (optional)"
                  controlId="draft-league"
                  description="Leave as a standalone draft, or attach it to a league you run."
                >
                  <Select value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
                    <option value="">Standalone draft</option>
                    {leagues.map((league) => (
                      <option key={league.id} value={league.id}>{league.name}</option>
                    ))}
                  </Select>
                </Field>

                <p className="-mt-[var(--space-2)]">
                  <Link
                    className="text-xs font-medium text-[color:var(--color-product-accent)] underline-offset-4 hover:underline"
                    href="/leagues/new"
                  >
                    + Create a league
                  </Link>
                </p>

                <Field label="Draft Name" controlId="draft-name">
                  <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                </Field>

                <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
                  <Field label="Teams" controlId="team-count">
                    <Input
                      type="number"
                      min={2}
                      max={20}
                      value={teamCount}
                      onChange={(e) => setTeamCount(Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Rounds" controlId="round-count">
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={rounds}
                      onChange={(e) => setRounds(Number(e.target.value))}
                    />
                  </Field>
                </div>

                {error && <Alert status="danger">{error}</Alert>}
              </FormLayout>
            </Panel>
          </>
        )}
      </div>
    </PageShell>
  );
}
