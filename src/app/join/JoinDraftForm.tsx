"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { joinDraft } from "@/lib/draftApi";
import { normalizeJoinCode } from "@/lib/participantLogic";
import { supabase } from "@/lib/supabase";
import { Alert, Button, Field, FormLayout, Input, PageShell, Panel } from "@/components/ui";

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
    <main className="flex flex-1 items-start justify-center">
      <PageShell width="readable">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-[var(--space-6)] text-center">
            <h1 className="text-[length:var(--font-size-page-title)] font-bold text-[color:var(--color-text-primary)]">
              Join Draft
            </h1>
            <p className="mt-[var(--space-2)] text-[color:var(--color-text-secondary)]">
              Enter your invite code to claim your seat.
            </p>
          </div>

          <Panel>
            <FormLayout
              onSubmit={handleSubmit}
              actions={
                <Button
                  type="submit"
                  loading={isJoining}
                  disabled={isDraftComplete || !!previewError}
                  fullWidth
                >
                  {isJoining ? "Joining..." : preview?.alreadyJoined ? "Rejoin Draft" : "Join Draft"}
                </Button>
              }
            >
              <Field label="Join Code" controlId="join-code">
                <Input
                  value={joinCode}
                  maxLength={12}
                  autoComplete="off"
                  onChange={(e) => setJoinCode(normalizeJoinCode(e.target.value))}
                />
              </Field>

              {isFetchingPreview && (
                <p className="text-center text-sm text-[color:var(--color-text-muted)]">Looking up draft...</p>
              )}

              {previewError && <Alert status="danger">{previewError}</Alert>}

              {/* The resolved draft, shown as a plain summary rather than a
                  second card — it already sits inside the form panel. */}
              {preview && !previewError && (
                <div className="space-y-[var(--space-1)] rounded-[var(--radius-surface)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] p-[var(--space-3)]">
                  <p className="font-bold text-[color:var(--color-text-primary)]">{preview.draftName}</p>
                  <p className="text-sm text-[color:var(--color-text-secondary)]">
                    {preview.teamCount} teams · {preview.rounds} rounds
                  </p>
                  {preview.invitedTeamName && (
                    <p className="mt-[var(--space-2)] text-sm font-medium text-[color:var(--color-product-accent)]">
                      Invited to manage{" "}
                      <span className="font-bold text-[color:var(--color-text-primary)]">
                        {preview.invitedTeamName}
                      </span>
                      .
                      {!signedInEmail && (
                        <span className="mt-[var(--space-1)] block font-normal text-[color:var(--color-warning-border)]">
                          Sign in with your invited email to claim this team.
                        </span>
                      )}
                    </p>
                  )}
                  {!preview.invitedTeamName && signedInEmail && (
                    <p className="mt-[var(--space-2)] text-sm text-[color:var(--color-text-secondary)]">
                      Signed in as{" "}
                      <span className="text-[color:var(--color-text-primary)]">{signedInEmail}</span>.
                    </p>
                  )}
                  {preview.alreadyJoined && (
                    <p className="mt-[var(--space-2)] text-sm font-medium text-[color:var(--color-product-accent)]">
                      You&apos;re already in this draft.
                    </p>
                  )}
                  {isDraftComplete && (
                    <p className="mt-[var(--space-2)] text-sm text-[color:var(--color-warning-border)]">
                      This draft is complete.
                    </p>
                  )}
                </div>
              )}

              <Field label="Your Display Name" controlId="display-name">
                <Input
                  value={displayName}
                  maxLength={50}
                  placeholder="How you'll appear in the draft room"
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </Field>

              {error && <Alert status="danger">{error}</Alert>}
            </FormLayout>
          </Panel>
        </div>
      </PageShell>
    </main>
  );
}
