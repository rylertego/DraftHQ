"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSleeperDraft,
  getDraftSetup,
  getSleeperLeaguePreview,
  inviteOwner,
} from "@/lib/draftApi";
import { createSleeperLeagueSeason } from "@/lib/leagueApi";
import { normalizeEmail } from "@/lib/email";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";
import { normalizeSleeperLeagueId, type SleeperLeaguePreview } from "@/lib/sleeper";

interface EditableTeam {
  rosterId: number;
  ownerUserId: string | null;
  managerName: string;
  teamName: string;
  ownerEmail: string;
}

interface SleeperImportFormProps {
  seasonContext?: {
    leagueId: string;
    year: number;
    seasonName: string;
  };
  leagueSlug?: string;
}

export default function SleeperImportForm({
  seasonContext,
  leagueSlug,
}: SleeperImportFormProps) {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [rounds, setRounds] = useState(15);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [teams, setTeams] = useState<EditableTeam[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  // Carried straight through from the preview so the created draft inherits the
  // league's real starting lineup and scoring format.
  const [lineup, setLineup] = useState<SleeperLeaguePreview["lineup"]>(null);
  const [scoringType, setScoringType] = useState<SleeperLeaguePreview["scoringType"]>(null);
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function loadPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedId = normalizeSleeperLeagueId(leagueId);
    if (!normalizedId) {
      setError("Enter a valid Sleeper league ID.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const preview = await getSleeperLeaguePreview(normalizedId);
      setLeagueId(preview.leagueId);
      setLeagueName(preview.leagueName);
      setRounds(preview.rounds);
      setDraftId(preview.draftId);
      setWarnings(preview.warnings);
      setLineup(preview.lineup);
      setScoringType(preview.scoringType);
      setTeams(
        preview.teams.map((team) => ({
          rosterId: team.rosterId,
          ownerUserId: team.ownerUserId,
          managerName: team.managerName,
          teamName: team.teamName,
          ownerEmail: "",
        }))
      );
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Unable to preview the Sleeper league."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function updateTeam(index: number, changes: Partial<EditableTeam>) {
    setTeams((current) =>
      current.map((team, teamIndex) =>
        teamIndex === index ? { ...team, ...changes } : team
      )
    );
  }

  function moveTeam(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= teams.length) {
      return;
    }

    setTeams((current) => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [
        reordered[target],
        reordered[index],
      ];
      return reordered;
    });
  }

  async function approveImport() {
    if (!leagueName.trim()) {
      setError("League name is required.");
      return;
    }

    if (rounds < 1 || rounds > 30) {
      setError("Rounds must be between 1 and 30.");
      return;
    }

    if (teams.some((team) => !team.teamName.trim())) {
      setError("Every imported team needs a name.");
      return;
    }

    const invalidEmail = teams.find(
      (team) => team.ownerEmail.trim() && !normalizeEmail(team.ownerEmail)
    );
    if (invalidEmail) {
      setError(`Enter a valid email for ${invalidEmail.managerName}.`);
      return;
    }

    setError("");
    setIsCreating(true);

    try {
      const preview: SleeperLeaguePreview = {
        leagueId,
        draftId,
        leagueName: leagueName.trim(),
        rounds,
        lineup,
        scoringType,
        warnings,
        teams: teams.map((team, index) => ({
          rosterId: team.rosterId,
          ownerUserId: team.ownerUserId,
          managerName: team.managerName,
          teamName: team.teamName.trim(),
          draftPosition: index + 1,
        })),
      };
      const createdDraftIdValue = seasonContext
        ? (
            await createSleeperLeagueSeason({
              ...seasonContext,
              draftName: leagueName.trim(),
              rounds,
              preview,
            })
          ).draftId
        : (await createSleeperDraft({ name: leagueName.trim(), rounds, preview }))
            .id;

      if (!createdDraftIdValue) {
        throw new Error("The season was created without a linked draft.");
      }

      setCreatedDraftId(createdDraftIdValue);
      const setup = await getDraftSetup(createdDraftIdValue);
      const invitationErrors: string[] = [];

      for (const [index, team] of teams.entries()) {
        const email = normalizeEmail(team.ownerEmail);
        if (!email) {
          continue;
        }

        try {
          const result = await inviteOwner(
            createdDraftIdValue,
            email,
            setup.teams[index].id
          );
          if (result.warning) {
            invitationErrors.push(`${team.managerName}: ${result.warning}`);
          }
        } catch (inviteError) {
          invitationErrors.push(
            `${team.managerName}: ${
              inviteError instanceof Error ? inviteError.message : "invite failed"
            }`
          );
        }
      }

      if (invitationErrors.length > 0) {
        setError(
          `Draft imported, but some invitations failed: ${invitationErrors.join("; ")}`
        );
        return;
      }

      router.push(`/teams?draftId=${createdDraftIdValue}&tab=settings${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to create the imported draft."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Panel
      title="Import from Sleeper"
      description="Preview league teams and draft order before anything is saved."
    >
      <form className="flex flex-col gap-[var(--space-3)] sm:flex-row" onSubmit={loadPreview}>
        <div className="min-w-0 flex-1">
          <Field label="Sleeper league ID" controlId="sleeper-league-id">
            <Input
              inputMode="numeric"
              placeholder="Sleeper league ID"
              value={leagueId}
              onChange={(event) => setLeagueId(event.target.value)}
            />
          </Field>
        </div>
        <div className="sm:self-end sm:pb-[var(--space-1)]">
          <Button type="submit" loading={isLoading} disabled={isCreating}>
            {isLoading ? "Loading..." : "Preview Import"}
          </Button>
        </div>
      </form>

      {teams.length > 0 && (
        <div className="mt-[var(--space-5)] flex flex-col gap-[var(--space-4)]">
          <div className="grid gap-[var(--space-3)] sm:grid-cols-[1fr_140px]">
            <Field label="Draft name" controlId="sleeper-name">
              <Input
                maxLength={100}
                value={leagueName}
                onChange={(event) => setLeagueName(event.target.value)}
              />
            </Field>
            <Field label="Rounds" controlId="sleeper-rounds">
              <Input
                type="number"
                min={1}
                max={30}
                value={rounds}
                onChange={(event) => setRounds(Number(event.target.value))}
              />
            </Field>
          </div>

          {warnings.map((warning) => (
            <Alert key={warning} status="warning">{warning}</Alert>
          ))}

          <div className="flex flex-col gap-[var(--space-3)]">
            {teams.map((team, index) => (
              <div
                key={team.rosterId}
                className="rounded-[var(--radius-surface)] border border-[color:var(--color-border-subtle)] p-[var(--space-3)]"
              >
                <div className="flex items-center gap-[var(--space-2)]">
                  <span className="w-8 text-center font-bold tabular-nums text-[color:var(--color-text-primary)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[color:var(--color-text-secondary)]">
                      Sleeper manager: {team.managerName}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={index === 0}
                    onClick={() => moveTeam(index, -1)}
                  >
                    Up
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={index === teams.length - 1}
                    onClick={() => moveTeam(index, 1)}
                  >
                    Down
                  </Button>
                </div>
                <div className="mt-[var(--space-3)] grid gap-[var(--space-2)] sm:grid-cols-2">
                  <Input
                    aria-label={`Team name for ${team.managerName}`}
                    maxLength={100}
                    value={team.teamName}
                    onChange={(event) => updateTeam(index, { teamName: event.target.value })}
                  />
                  <Input
                    aria-label={`Email for ${team.managerName}`}
                    type="email"
                    maxLength={320}
                    placeholder="Optional invitation email"
                    value={team.ownerEmail}
                    onChange={(event) => updateTeam(index, { ownerEmail: event.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            fullWidth
            loading={isCreating}
            disabled={Boolean(createdDraftId)}
            onClick={() => void approveImport()}
          >
            {isCreating
              ? "Creating DraftHQ draft..."
              : seasonContext
                ? "Approve and Create Season"
                : "Approve and Create Draft"}
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-[var(--space-4)]">
          <Alert status="danger">{error}</Alert>
        </div>
      )}

      {createdDraftId && (
        <div className="mt-[var(--space-3)]">
          <Button
            variant="secondary"
            onClick={() => router.push(`/teams?draftId=${createdDraftId}&tab=settings${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`)}
          >
            Continue to Team Setup
          </Button>
        </div>
      )}
    </Panel>
  );
}
