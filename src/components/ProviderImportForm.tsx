"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeEmail } from "@/lib/email";
import { createImportedLeagueSeason } from "@/lib/leagueApi";
import { getDraftSetup, inviteOwner } from "@/lib/draftApi";
import type { ProviderLeaguePreview } from "@/lib/providers/types";
import { Alert, Button, Field, Input } from "@/components/ui";

interface EditableTeam {
  externalId: string;
  ownerName: string;
  teamName: string;
  ownerEmail: string;
}

interface ProviderImportFormProps {
  preview: ProviderLeaguePreview;
  seasonContext: {
    leagueId: string;
    year: number;
    seasonName: string;
  };
  onBack: () => void;
  leagueSlug?: string;
}

export default function ProviderImportForm({
  preview,
  seasonContext,
  onBack,
  leagueSlug,
}: ProviderImportFormProps) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(preview.leagueName);
  const [rounds, setRounds] = useState(preview.rounds);
  const [teams, setTeams] = useState<EditableTeam[]>(
    preview.teams.map((team) => ({
      externalId: team.externalId,
      ownerName: team.ownerName,
      teamName: team.teamName,
      ownerEmail: "",
    }))
  );
  const [isCreating, setIsCreating] = useState(false);
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function updateTeam(index: number, changes: Partial<EditableTeam>) {
    setTeams((current) =>
      current.map((team, i) => (i === index ? { ...team, ...changes } : team))
    );
  }

  function moveTeam(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= teams.length) return;
    setTeams((current) => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  }

  async function handleApprove() {
    if (!draftName.trim()) {
      setError("Draft name is required.");
      return;
    }
    if (rounds < 1 || rounds > 30) {
      setError("Rounds must be between 1 and 30.");
      return;
    }
    if (teams.some((team) => !team.teamName.trim())) {
      setError("Every team needs a name.");
      return;
    }
    const invalidEmail = teams.find(
      (team) => team.ownerEmail.trim() && !normalizeEmail(team.ownerEmail)
    );
    if (invalidEmail) {
      setError(`Enter a valid email for ${invalidEmail.ownerName}.`);
      return;
    }

    setError("");
    setIsCreating(true);

    try {
      const season = await createImportedLeagueSeason({
        leagueId: seasonContext.leagueId,
        year: seasonContext.year,
        seasonName: seasonContext.seasonName,
        draftName: draftName.trim(),
        rounds,
        teamNames: teams.map((team) => team.teamName.trim()),
      });

      if (!season.draftId) {
        throw new Error("The season was created without a linked draft.");
      }

      setCreatedDraftId(season.draftId);
      const setup = await getDraftSetup(season.draftId);
      const invitationErrors: string[] = [];

      for (const [index, team] of teams.entries()) {
        const email = normalizeEmail(team.ownerEmail);
        if (!email) continue;
        try {
          const result = await inviteOwner(season.draftId, email, setup.teams[index].id);
          if (result.warning) {
            invitationErrors.push(`${team.ownerName}: ${result.warning}`);
          }
        } catch (inviteError) {
          invitationErrors.push(
            `${team.ownerName}: ${inviteError instanceof Error ? inviteError.message : "invite failed"}`
          );
        }
      }

      if (invitationErrors.length > 0) {
        setError(`Season created, but some invitations failed: ${invitationErrors.join("; ")}`);
        return;
      }

      router.push(`/teams?draftId=${season.draftId}&tab=settings${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`);
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Unable to create the season."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {preview.warnings.map((warning) => (
        <Alert key={warning} status="warning">{warning}</Alert>
      ))}

      <div className="grid gap-[var(--space-3)] sm:grid-cols-[1fr_140px]">
        <Field label="Draft name" controlId="import-draft-name">
          <Input
            maxLength={100}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
          />
        </Field>
        <Field label="Rounds" controlId="import-rounds">
          <Input
            type="number"
            min={1}
            max={30}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-[var(--space-3)]">
        {teams.map((team, index) => (
          <div
            key={team.externalId}
            className="rounded-[var(--radius-surface)] border border-[color:var(--color-border-subtle)] p-[var(--space-3)]"
          >
            <div className="flex items-center gap-[var(--space-2)]">
              <span className="w-8 text-center font-bold tabular-nums text-[color:var(--color-text-primary)]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[color:var(--color-text-secondary)]">
                  {team.ownerName}
                </p>
              </div>
              <Button variant="secondary" disabled={index === 0} onClick={() => moveTeam(index, -1)}>
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
                aria-label={`Team name for ${team.ownerName}`}
                maxLength={100}
                value={team.teamName}
                onChange={(e) => updateTeam(index, { teamName: e.target.value })}
              />
              <Input
                aria-label={`Email for ${team.ownerName}`}
                type="email"
                maxLength={320}
                placeholder="Optional invitation email"
                value={team.ownerEmail}
                onChange={(e) => updateTeam(index, { ownerEmail: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      {error && <Alert status="danger">{error}</Alert>}

      <div className="flex gap-[var(--space-3)]">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <div className="flex-1">
          <Button
            fullWidth
            loading={isCreating}
            disabled={Boolean(createdDraftId)}
            onClick={() => void handleApprove()}
          >
            {isCreating ? "Creating season..." : "Approve and Create Season"}
          </Button>
        </div>
      </div>

      {createdDraftId && (
        <Button
          variant="secondary"
          fullWidth
          onClick={() => router.push(`/teams?draftId=${createdDraftId}&tab=settings${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`)}
        >
          Continue to Team Setup
        </Button>
      )}
    </div>
  );
}
