"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignTeam,
  getDraftSetup,
  inviteOwner,
  updateTeamSetup,
  type DraftSetup,
} from "@/lib/draftApi";
import { getAssignedTeamIds } from "@/lib/participantLogic";
import { buildOwnerInvitationMessage } from "@/lib/ownerInvitation";
import { moveDraftTeam } from "@/lib/teamSetupLogic";
import type { DraftInvitation, Team } from "@/types/draft";

interface TeamSetupFormProps {
  draftId: string | null;
}

export default function TeamSetupForm({ draftId }: TeamSetupFormProps) {
  const router = useRouter();
  const [setup, setSetup] = useState<DraftSetup | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assigningParticipantId, setAssigningParticipantId] = useState<
    string | null
  >(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!draftId) {
      router.replace("/create");
      return;
    }

    let cancelled = false;

    async function loadTeams() {
      try {
        const loadedSetup = await getDraftSetup(draftId as string);

        if (!cancelled) {
          setSetup(loadedSetup);
          setTeams(loadedSetup.teams);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load teams."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTeams();

    return () => {
      cancelled = true;
    };
  }, [draftId, router]);

  function updateTeam(teamId: string, value: string) {
    setTeams((current) =>
      current.map((team) =>
        team.id === teamId ? { ...team, name: value } : team
      )
    );
  }

  function moveTeam(index: number, offset: -1 | 1) {
    setTeams((current) => moveDraftTeam(current, index, offset));
  }

  async function refreshParticipants() {
    if (!draftId) {
      return;
    }

    setError("");
    setIsRefreshing(true);

    try {
      const refreshedSetup = await getDraftSetup(draftId);
      setSetup(refreshedSetup);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh participants."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function updateAssignment(participantId: string, teamId: string) {
    if (!draftId || !setup) {
      return;
    }

    setError("");
    setAssigningParticipantId(participantId);

    try {
      const updatedParticipant = await assignTeam(
        draftId,
        participantId,
        teamId || null
      );

      setSetup({
        ...setup,
        participants: setup.participants.map((participant) =>
          participant.id === participantId ? updatedParticipant : participant
        ),
      });
    } catch (assignmentError) {
      setError(
        assignmentError instanceof Error
          ? assignmentError.message
          : "Unable to assign the team."
      );
    } finally {
      setAssigningParticipantId(null);
    }
  }

  async function copyJoinLink() {
    if (!setup) {
      return;
    }

    const joinUrl = `${window.location.origin}/join/${setup.draft.joinCode}`;

    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopyStatus("Join link copied.");
    } catch {
      setCopyStatus(`Share this link: ${joinUrl}`);
    }
  }

  async function sendEmailInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const sendEmail = submitter?.getAttribute("data-delivery") !== "manual";

    if (!draftId || !setup || !inviteEmail.trim() || !inviteTeamId) {
      return;
    }

    setError("");
    setIsInviting(true);

    try {
      const result = await inviteOwner(
        draftId,
        inviteEmail.trim(),
        inviteTeamId,
        { sendEmail }
      );
      const invitation = result.invitation;
      const invitedTeam = teams.find((team) => team.id === invitation.teamId);
      const existingIndex = setup.invitations.findIndex(
        (current) => current.id === invitation.id
      );
      const invitations =
        existingIndex === -1
          ? [...setup.invitations, invitation]
          : setup.invitations.map((current) =>
              current.id === invitation.id ? invitation : current
            );

      setSetup({ ...setup, invitations });
      setInviteEmail("");
      setInviteTeamId("");
      if (!sendEmail && invitedTeam) {
        await copyOwnerInviteDetails(invitation, invitedTeam);
      } else {
        setCopyStatus(
          result.warning
            ? `${result.warning} Use Copy Invite below to share it manually.`
            : "Invitation reserved and email requested."
        );
      }
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : "Unable to send invitation."
      );
    } finally {
      setIsInviting(false);
    }
  }

  async function copyOwnerInvite(invitationId: string) {
    const invitation = setup?.invitations.find(
      (current) => current.id === invitationId
    );
    const team = teams.find((current) => current.id === invitation?.teamId);

    if (!setup || !invitation || !team) {
      return;
    }

    await copyOwnerInviteDetails(invitation, team);
  }

  async function copyOwnerInviteDetails(
    invitation: DraftInvitation,
    team: Team
  ) {
    if (!setup) {
      return;
    }

    const joinUrl = `${window.location.origin}/join/${setup.draft.joinCode}`;
    const message = buildOwnerInvitationMessage({
      draftName: setup.draft.name,
      teamName: team.name,
      email: invitation.email,
      joinUrl,
    });

    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus(`Invite for ${invitation.email} copied.`);
    } catch {
      setCopyStatus(message);
    }
  }

  async function continueToDraft() {
    if (!draftId) {
      return;
    }

    if (teams.some((team) => !team.name.trim())) {
      setError("Every team must have a name.");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      await updateTeamSetup(draftId, teams);
      router.push(`/draft?draftId=${draftId}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save teams."
      );
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <main className="max-w-2xl mx-auto p-8">Loading teams...</main>;
  }

  if (!setup) {
    return (
      <main className="max-w-2xl mx-auto p-8 text-red-500">
        {error || "Unable to load draft setup."}
      </main>
    );
  }

  const isCommissioner =
    setup.currentUserId === setup.draft.commissionerUserId;
  const canManageAssignments =
    setup.draft.status === "setup" || setup.draft.status === "paused";

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-8">
      <section>
        <h1 className="text-3xl font-bold mb-2">Team Setup</h1>
        <p className="text-gray-400">Join code: {setup.draft.joinCode}</p>
        <div className="flex items-center gap-3 mt-3">
          <a
            className="text-blue-400 underline"
            href={`/join/${setup.draft.joinCode}`}
            target="_blank"
            rel="noreferrer"
          >
            Open join page
          </a>
          <button
            type="button"
            className="bg-gray-700 px-3 py-1 rounded"
            onClick={copyJoinLink}
          >
            Copy Join Link
          </button>
        </div>
        {copyStatus && <p className="text-sm text-gray-400 mt-2">{copyStatus}</p>}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-3">Teams</h2>
        <div className="space-y-3">
          {teams.map((team, index) => (
            <div key={team.id} className="flex items-center gap-2">
              <span className="w-8 text-center font-bold">{index + 1}</span>
              <input
                aria-label={`Team ${index + 1} name`}
                disabled={!isCommissioner}
                className="min-w-0 flex-1 rounded border p-2 disabled:opacity-60"
                value={team.name}
                onChange={(event) => updateTeam(team.id, event.target.value)}
              />
              {isCommissioner && (
                <>
                  <button
                    type="button"
                    aria-label={`Move ${team.name} up`}
                    disabled={index === 0}
                    className="rounded bg-gray-700 px-3 py-2 disabled:opacity-30"
                    onClick={() => moveTeam(index, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${team.name} down`}
                    disabled={index === teams.length - 1}
                    className="rounded bg-gray-700 px-3 py-2 disabled:opacity-30"
                    onClick={() => moveTeam(index, 1)}
                  >
                    Down
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {isCommissioner && (
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-3">Invite Owners</h2>
            <form
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={sendEmailInvitation}
            >
              <input
                type="email"
                required
                maxLength={320}
                className="border rounded p-2 flex-1"
                placeholder="owner@example.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
              <select
                required
                aria-label="Team for invited owner"
                className="border rounded p-2 bg-gray-900"
                value={inviteTeamId}
                onChange={(event) => setInviteTeamId(event.target.value)}
              >
                <option value="">Select team</option>
                {teams.map((team) => {
                  const isUnavailable =
                    setup.participants.some(
                      (participant) => participant.teamId === team.id
                    ) ||
                    setup.invitations.some(
                      (invitation) =>
                        invitation.status === "pending" &&
                        invitation.teamId === team.id
                    );

                  return (
                    <option
                      key={team.id}
                      value={team.id}
                      disabled={isUnavailable}
                    >
                      {team.name}
                    </option>
                  );
                })}
              </select>
              <button
                type="submit"
                data-delivery="email"
                disabled={isInviting}
                className="bg-blue-600 disabled:opacity-50 px-4 py-2 rounded"
              >
                {isInviting ? "Sending..." : "Send Invite"}
              </button>
              <button
                type="submit"
                data-delivery="manual"
                disabled={isInviting}
                className="rounded bg-gray-700 px-4 py-2 disabled:opacity-50 sm:col-start-3"
              >
                Reserve & Copy
              </button>
            </form>

            {setup.invitations.length > 0 && (
              <div className="mt-3 space-y-2">
                {setup.invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="border border-gray-700 rounded p-2 flex justify-between gap-3"
                  >
                    <span>
                      {invitation.email}
                      {invitation.teamId && (
                        <span className="text-gray-400">
                          {" "}
                          - {teams.find(
                            (team) => team.id === invitation.teamId
                          )?.name}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 capitalize">
                        {invitation.status}
                      </span>
                      {invitation.status === "pending" && invitation.teamId && (
                        <button
                          type="button"
                          className="rounded bg-gray-700 px-2 py-1 text-sm"
                          onClick={() => copyOwnerInvite(invitation.id)}
                        >
                          Copy Invite
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold">Owners</h2>
              <button
                type="button"
                disabled={isRefreshing}
                className="bg-gray-700 disabled:opacity-50 px-3 py-1 rounded"
                onClick={refreshParticipants}
              >
                {isRefreshing ? "Refreshing..." : "Refresh Owners"}
              </button>
            </div>

            <div className="space-y-3">
              {!canManageAssignments && (
                <p className="text-sm text-yellow-400">
                  Pause the draft before changing team assignments.
                </p>
              )}
              {setup.participants.map((participant) => {
                const unavailableTeamIds = getAssignedTeamIds(
                  setup.participants,
                  participant.id
                );

                return (
                  <div
                    key={participant.id}
                    className="border border-gray-700 rounded p-3 flex items-center gap-3"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">
                        {participant.displayName}
                      </div>
                      <div className="text-xs text-gray-400 capitalize">
                        {participant.role}
                      </div>
                    </div>

                    <select
                      aria-label={`Team for ${participant.displayName}`}
                      className="border rounded p-2 bg-gray-900"
                      value={participant.teamId ?? ""}
                      disabled={
                        !canManageAssignments ||
                        assigningParticipantId === participant.id
                      }
                      onChange={(event) =>
                        updateAssignment(participant.id, event.target.value)
                      }
                    >
                      <option value="">Unassigned</option>
                      {teams.map((team) => (
                        <option
                          key={team.id}
                          value={team.id}
                          disabled={unavailableTeamIds.includes(team.id)}
                        >
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {isCommissioner ? (
        <button
          onClick={continueToDraft}
          disabled={isSaving || teams.length === 0}
          className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded"
        >
          {isSaving ? "Saving..." : "Continue"}
        </button>
      ) : (
        <button
          onClick={() => router.push(`/draft?draftId=${draftId}`)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Open Draft
        </button>
      )}
    </main>
  );
}
