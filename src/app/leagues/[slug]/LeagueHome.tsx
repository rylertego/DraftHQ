"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LeagueCommandCenter from "@/components/LeagueCommandCenter";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { createDraftForSeason, resetSeasonDraft } from "@/lib/leagueApi";
import { updateDraftSchedule } from "@/lib/draftApi";
import { localTimeZone, zonedWallClockToUtc } from "@/lib/draftSchedule";
import type { LeagueSeason } from "@/types/league";
import {
  Alert,
  Button,
  Dialog,
  Field,
  FormLayout,
  Input,
  Skeleton,
} from "@/components/ui";

function ResetDraftModal({ seasonId, onClose, onReset }: { seasonId: string; onClose: () => void; onReset: () => void }) {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleReset() {
    if (confirm !== "RESET") return;
    setIsResetting(true);
    setError("");
    try {
      await resetSeasonDraft(seasonId);
      onReset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reset draft.");
      setIsResetting(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="small"
      title="Reset Draft?"
      description="This will permanently delete the draft and all its picks. The season will return to its no-draft state. This cannot be undone."
      initialFocusRef={inputRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isResetting}>
            Cancel
          </Button>
          {/* Destructive stays danger even inside a league accent. */}
          <Button
            variant="danger"
            loading={isResetting}
            disabled={confirm !== "RESET"}
            onClick={() => void handleReset()}
          >
            {isResetting ? "Resetting..." : "Delete Draft"}
          </Button>
        </>
      }
    >
      <Field label="Type RESET to confirm" controlId="reset-draft-confirm">
        <Input
          ref={inputRef}
          type="text"
          maxLength={10}
          placeholder="RESET"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") void handleReset(); }}
        />
      </Field>

      {error && <Alert status="danger">{error}</Alert>}
    </Dialog>
  );
}

function CreateDraftModal({
  season,
  maxTeams,
  onClose,
  onCreated,
}: {
  season: LeagueSeason;
  maxTeams: number;
  onClose: () => void;
  onCreated: (draftId: string) => void;
}) {
  const currentYear = season.year;
  const [draftName, setDraftName] = useState(`${currentYear} Draft`);
  const [teamCount, setTeamCount] = useState(maxTeams);
  const [rounds, setRounds] = useState(15);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("19:00");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setError("");
    try {
      const createdSeason = await createDraftForSeason({
        seasonId: season.id,
        draftName,
        teamCount,
        rounds,
      });
      if (!createdSeason.draftId) throw new Error("The season was created without a draft.");
      if (scheduledDate) {
        // The date is optional, and the draft already exists by this point — a
        // failed schedule save must not read as a failed draft creation.
        const timezone = localTimeZone();
        const iso = zonedWallClockToUtc(scheduledDate, scheduledTime, timezone);
        try {
          await updateDraftSchedule(createdSeason.draftId, iso, timezone);
        } catch {
          // Swallowed on purpose: the commissioner lands on draft settings next,
          // where the same date fields are available.
        }
      }
      onCreated(createdSeason.draftId);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Unable to create draft.";
      setError(msg);
      setIsCreating(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="small"
      title={`Create Draft — ${season.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button type="submit" form="create-draft-form" scope="league" loading={isCreating}>
            {isCreating ? "Creating..." : "Create Draft"}
          </Button>
        </>
      }
    >
      <FormLayout id="create-draft-form" onSubmit={(e) => void handleSubmit(e)}>
        <Field label="Draft Name" controlId="create-draft-name">
          <Input required maxLength={100} value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-[var(--space-3)]">
          <Field label="Teams" controlId="create-draft-teams" description="Set in league settings.">
            <Input
              type="number"
              min={2}
              max={20}
              value={teamCount}
              disabled
              onChange={(e) => setTeamCount(Number(e.target.value))}
            />
          </Field>
          <Field label="Rounds" controlId="create-draft-rounds">
            <Input type="number" min={1} max={30} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} />
          </Field>
        </div>

        <Field
          label="Draft Date (optional)"
          controlId="create-draft-date"
          description={
            scheduledDate
              ? "Owners see this as a countdown. You can change it later in draft settings."
              : "Set it now or later — owners see a countdown as soon as it is set."
          }
        >
          <div className="grid grid-cols-2 gap-[var(--space-3)]">
            <Input
              type="date"
              aria-label="Draft date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
            <Input
              type="time"
              aria-label="Draft start time"
              disabled={!scheduledDate}
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </div>
        </Field>

        {error && <Alert status="danger">{error}</Alert>}
      </FormLayout>
    </Dialog>
  );
}

export default function LeagueHome({ slug }: { slug: string }) {
  const router = useRouter();
  const { workspace, isLoading, error, reload } = useWorkspace();
  const [showReset, setShowReset] = useState(false);
  const [showCreateDraft, setShowCreateDraft] = useState(false);

  if (isLoading && !workspace) {
    return (
      <div className="flex flex-col gap-[var(--space-5)]" aria-label="Loading league dashboard">
        <Skeleton height="mark-large" label="Loading league dashboard" />
        <div className="grid gap-[var(--space-4)] lg:grid-cols-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} height="mark-large" />)}
        </div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <Alert
        status="danger"
        title="Unable to load league dashboard"
        action={
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        }
      >
        {error || "League not found."}
      </Alert>
    );
  }

  const currentSeason = workspace.seasons[0];

  return (
    <>
      <LeagueCommandCenter
        workspace={workspace}
        slug={slug}
        onConfigureDraft={() => setShowCreateDraft(true)}
        onResetDraft={() => setShowReset(true)}
      />

      {showReset && currentSeason && (
        <ResetDraftModal seasonId={currentSeason.id} onClose={() => setShowReset(false)} onReset={reload} />
      )}

      {showCreateDraft && currentSeason && (
        <CreateDraftModal
          season={currentSeason}
          maxTeams={workspace.league.teamCount}
          onClose={() => setShowCreateDraft(false)}
          onCreated={(draftId) => router.push(`/teams?draftId=${draftId}&tab=settings&leagueSlug=${slug}`)}
        />
      )}
    </>
  );
}
