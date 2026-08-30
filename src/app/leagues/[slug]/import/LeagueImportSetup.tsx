"use client";

import { FormEvent, useEffect, useState } from "react";
import { LeagueImportFlow } from "@/components/LeagueImportModal";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import {
  createLeagueTeam,
  getLeagueTeams,
  getPendingLeagueInvitations,
  inviteLeagueMember,
  type LeagueImportProvider,
  type PendingLeagueInvitation,
} from "@/lib/leagueApi";
import { shouldShowLeagueSourceSetup } from "@/lib/leagueOnboarding";
import type { LeagueTeam } from "@/types/league";
import {
  Alert,
  Button,
  Field,
  FormLayout,
  Input,
  LinkButton,
  PageHeader,
  Panel,
} from "@/components/ui";

export default function LeagueImportSetup({ slug }: { slug: string }) {
  const { workspace, isLoading, error: workspaceError, reload } = useWorkspace();
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingLeagueInvitation[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [inviteEmails, setInviteEmails] = useState<Record<string, string>>({});
  const [activeInviteTeamId, setActiveInviteTeamId] = useState<string | null>(null);
  const [importedProvider, setImportedProvider] = useState<LeagueImportProvider | null>(null);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [addingTeam, setAddingTeam] = useState(false);
  const [sendingInviteTeamId, setSendingInviteTeamId] = useState<string | null>(null);

  const league = workspace?.league;
  const canManage = workspace?.canManage ?? false;
  const activeTeams = teams.filter((team) => !team.archivedAt);
  const availableSlots = Math.max((league?.teamCount ?? 0) - activeTeams.length, 0);
  const hasTeams = activeTeams.length > 0;
  const activeIntegration = importedProvider ?? league?.activeIntegration ?? null;
  const showSourceSetup = shouldShowLeagueSourceSetup(activeIntegration);
  const leagueHomePath = `/leagues/${slug}`;
  const leagueTeamsPath = `/leagues/${slug}/teams`;

  useEffect(() => {
    if (!league) return;
    let active = true;
    void Promise.all([
      getLeagueTeams(league.id),
      getPendingLeagueInvitations(league.id),
    ])
      .then(([loadedTeams, loadedInvites]) => {
        if (!active) return;
        setTeams(loadedTeams);
        setPendingInvites(loadedInvites);
      })
      .catch((err) => {
        if (active) setActionError(err instanceof Error ? err.message : "Unable to load teams.");
      })
      .finally(() => {
        if (active) setTeamsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [league]);

  async function refreshTeams(message?: string) {
    if (!league) return;
    const [loadedTeams, loadedInvites] = await Promise.all([
      getLeagueTeams(league.id),
      getPendingLeagueInvitations(league.id),
    ]);
    setTeams(loadedTeams);
    setPendingInvites(loadedInvites);
    reload();
    if (message) setSuccessMessage(message);
  }

  async function handleAddTeam(event: FormEvent) {
    event.preventDefault();
    if (!league || !teamName.trim()) return;
    setAddingTeam(true);
    setActionError("");
    try {
      const team = await createLeagueTeam(league.id, {
        name: teamName.trim(),
        ownerName: ownerName.trim() || undefined,
      });
      setTeams((current) => [...current, team]);
      setTeamName("");
      setOwnerName("");
      setSuccessMessage(`${team.name} added.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to add team.");
    } finally {
      setAddingTeam(false);
    }
  }

  async function handleInviteOwner(event: FormEvent, team: LeagueTeam) {
    event.preventDefault();
    const email = inviteEmails[team.id]?.trim() ?? "";
    if (!league || !email) return;
    setSendingInviteTeamId(team.id);
    setActionError("");
    try {
      await inviteLeagueMember(league.id, email, { leagueTeamId: team.id });
      setSuccessMessage(`Invitation sent to ${email}.`);
      setInviteEmails((current) => ({ ...current, [team.id]: "" }));
      setActiveInviteTeamId(null);
      setPendingInvites(await getPendingLeagueInvitations(league.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to send invitation.");
    } finally {
      setSendingInviteTeamId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-[var(--space-5)]">
        <div className="h-36 animate-pulse rounded-[var(--radius-surface)] bg-[var(--color-surface-2)]" />
        <div className="h-64 animate-pulse rounded-[var(--radius-surface)] bg-[var(--color-surface-2)]" />
      </div>
    );
  }

  if (workspaceError || !workspace || !league) {
    return <Alert status="danger">{workspaceError || "League not found."}</Alert>;
  }

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Alert status="danger">Only commissioners can set up league teams.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-[var(--space-5)]">
      <div className="flex items-start justify-between gap-[var(--space-4)]">
        <PageHeader
          title={activeIntegration ? "Invite Team Owners" : "Import Or Add Teams"}
          description={
            activeIntegration
              ? `${league.name} is connected to ${providerLabel(activeIntegration)}. Invite owners from the team list.`
              : `Set up ${league.name}, then invite owners into the league.`
          }
        />
        <LinkButton href={leagueHomePath} variant="secondary">
          Skip for now
        </LinkButton>
      </div>

      {successMessage && <Alert status="success">{successMessage}</Alert>}
      {actionError && <Alert status="danger">{actionError}</Alert>}

      {showSourceSetup && (
        <Panel>
          <div className="border-b border-[color:var(--color-border-subtle)] px-[var(--space-5)] py-[var(--space-4)]">
            <h2 className="text-lg font-black text-[color:var(--color-text-primary)]">Import From A Provider</h2>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
              Bring in teams and owner names from your existing league.
            </p>
          </div>
          <div className="p-[var(--space-5)]">
            <LeagueImportFlow
              leagueId={league.id}
              availableSlots={availableSlots}
              onImported={async (count, provider) => {
                setImportedProvider(provider);
                await refreshTeams(`${count} team${count === 1 ? "" : "s"} imported.`);
              }}
            />
          </div>
        </Panel>
      )}

      <div className={showSourceSetup ? "grid gap-[var(--space-5)] lg:grid-cols-[420px_minmax(0,1fr)]" : ""}>
        {showSourceSetup && (
          <Panel>
            <div className="border-b border-[color:var(--color-border-subtle)] px-[var(--space-5)] py-[var(--space-4)]">
              <h2 className="text-lg font-black text-[color:var(--color-text-primary)]">Add Teams Manually</h2>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                Add franchises one at a time if you are not importing.
              </p>
            </div>
            <div className="p-[var(--space-5)]">
              <FormLayout
                onSubmit={handleAddTeam}
                actions={
                  <Button
                    type="submit"
                    scope="league"
                    loading={addingTeam}
                    disabled={!teamName.trim() || availableSlots === 0}
                  >
                    {addingTeam ? "Adding..." : "Add Team"}
                  </Button>
                }
              >
                <div className="grid gap-[var(--space-4)]">
                  <Field label="Team Name" controlId="setup-team-name" required>
                    <Input
                      required
                      maxLength={100}
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                    />
                  </Field>
                  <Field label="Owner Name" controlId="setup-owner-name">
                    <Input
                      maxLength={100}
                      value={ownerName}
                      onChange={(event) => setOwnerName(event.target.value)}
                    />
                  </Field>
                </div>
              </FormLayout>
            </div>
          </Panel>
        )}

        <Panel>
          <div className="border-b border-[color:var(--color-border-subtle)] px-[var(--space-5)] py-[var(--space-4)]">
            <h2 className="text-lg font-black text-[color:var(--color-text-primary)]">Teams</h2>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
              Invite each owner from the team they should claim.
            </p>
          </div>
          <div className="p-[var(--space-5)]">
            {teamsLoading ? (
              <div className="h-24 animate-pulse rounded-[var(--radius-control)] bg-[var(--color-surface-2)]" />
            ) : hasTeams ? (
              <div className="divide-y divide-[color:var(--color-border-subtle)] overflow-hidden rounded-[var(--radius-control)] border border-[color:var(--color-border-subtle)]">
                {activeTeams.map((team) => {
                  const pendingInvite = pendingInvites.find((invite) => invite.teamName === team.name);
                  const inviteOpen = activeInviteTeamId === team.id;
                  const email = inviteEmails[team.id] ?? "";
                  return (
                    <div
                      key={team.id}
                      className="grid gap-[var(--space-3)] bg-[var(--color-surface-2)] px-[var(--space-4)] py-[var(--space-3)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[color:var(--color-text-primary)]">{team.name}</p>
                        <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
                          {team.ownerUserId
                            ? "Owner assigned"
                            : pendingInvite
                              ? `Invite pending for ${pendingInvite.email}`
                              : team.ownerName
                                ? `Imported owner: ${team.ownerName}`
                                : "No owner invited yet"}
                        </p>
                      </div>

                      {team.ownerUserId ? (
                        <span className="text-sm font-semibold text-[color:var(--color-text-secondary)]">
                          Assigned
                        </span>
                      ) : inviteOpen ? (
                        <form
                          onSubmit={(event) => void handleInviteOwner(event, team)}
                          className="grid gap-[var(--space-2)] sm:grid-cols-[minmax(220px,1fr)_auto_auto]"
                        >
                          <Input
                            type="email"
                            required
                            maxLength={320}
                            placeholder="owner@example.com"
                            value={email}
                            onChange={(event) =>
                              setInviteEmails((current) => ({
                                ...current,
                                [team.id]: event.target.value,
                              }))
                            }
                          />
                          <Button
                            type="submit"
                            scope="league"
                            loading={sendingInviteTeamId === team.id}
                            disabled={!email.trim()}
                          >
                            Send
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setActiveInviteTeamId(null)}
                            disabled={sendingInviteTeamId === team.id}
                          >
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setActiveInviteTeamId(team.id)}
                        >
                          Invite owner
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[var(--radius-control)] border border-dashed border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] px-[var(--space-4)] py-[var(--space-5)] text-sm text-[color:var(--color-text-secondary)]">
                Add or import teams first, then invite owners into this league.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap justify-end gap-[var(--space-3)]">
        <LinkButton href={leagueTeamsPath} variant="secondary">
          Review Teams
        </LinkButton>
        <LinkButton href={leagueHomePath} scope="league" disabled={!hasTeams}>
          Continue
        </LinkButton>
      </div>
    </div>
  );
}

function providerLabel(provider: LeagueImportProvider) {
  return provider === "espn" ? "ESPN" : provider[0].toUpperCase() + provider.slice(1);
}
