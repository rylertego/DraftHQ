"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { leaveLeague } from "@/lib/leagueApi";
import {
  CommandButton,
  CommandModal,
  CommandPanel,
  CommandStatusBadge,
} from "@/components/CommandCenterUI";

/**
 * Settings for someone who does not run the league.
 *
 * Deliberately near-empty. A member has exactly one setting that is theirs to
 * change — whether they are in the league at all. Everything else on the
 * commissioner's settings page is league configuration they cannot act on, and
 * showing it read-only would repeat the mistake the owner dashboard was built
 * to fix: a screen full of controls belonging to someone else.
 */
export default function MemberSettings() {
  const router = useRouter();
  const { workspace, reload } = useWorkspace();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");

  if (!workspace) return null;

  const leagueName = workspace.league.name;
  const teamName = workspace.myTeam?.name ?? null;

  async function handleLeave() {
    if (!workspace) return;
    setLeaving(true);
    setError("");
    try {
      await leaveLeague(workspace.league.id);
      reload();
      router.push("/dashboard");
      router.refresh();
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Unable to leave the league.");
      setLeaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <CommandPanel
        eyebrow="Membership"
        title="League Settings"
        description={`Your membership in ${leagueName}. League configuration is managed by the commissioner.`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Leave this league</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              {teamName
                ? `You will be removed from ${leagueName}, and ${teamName} will be released for the commissioner to reassign.`
                : `You will be removed from ${leagueName} and will lose access to its draft.`}{" "}
              You can be invited back.
            </p>
          </div>
          <CommandButton
            type="button"
            variant="danger"
            onClick={() => setConfirming(true)}
            className="shrink-0"
          >
            Leave League
          </CommandButton>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
            {error}
          </p>
        )}
      </CommandPanel>

      {confirming && (
        <CommandModal
          eyebrow="Membership"
          title={`Leave ${leagueName}?`}
          description={
            teamName
              ? `${teamName} will be released and the commissioner can reassign it. You will need a new invitation to rejoin.`
              : "You will lose access to this league and its draft. You will need a new invitation to rejoin."
          }
          badge={<CommandStatusBadge label="Destructive" tone="danger" />}
          onClose={leaving ? undefined : () => setConfirming(false)}
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <CommandButton
                type="button"
                onClick={() => setConfirming(false)}
                disabled={leaving}
                className="sm:min-w-28"
              >
                Cancel
              </CommandButton>
              <CommandButton
                type="button"
                variant="danger"
                onClick={() => void handleLeave()}
                disabled={leaving}
                className="sm:min-w-32"
              >
                {leaving ? "Leaving..." : "Leave League"}
              </CommandButton>
            </div>
          }
        >
          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
              {error}
            </p>
          )}
        </CommandModal>
      )}
    </div>
  );
}
