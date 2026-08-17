"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyLeagueInvitations, respondToLeagueInvitation } from "@/lib/leagueApi";
import type { LeagueInvitationInboxItem } from "@/lib/leagueApi";
import { supabase } from "@/lib/supabase";
import { Button, EmptyState, InlineNotice, Panel, Popover, Section, TeamMark } from "@/components/ui";

export default function LeagueInvitationInbox({ userId }: { userId: string }) {
  const router = useRouter();
  const [invitations, setInvitations] = useState<LeagueInvitationInboxItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const items = await getMyLeagueInvitations();
      setInvitations(items);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load invitations.");
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const channel = supabase
      .channel(`league-invitations:${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "league_invitations", filter: `invited_user_id=eq.${userId}`,
      }, () => void load())
      .subscribe();
    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(channel);
    };
  }, [load, userId]);

  // Popover owns dismissal and focus; the previous hand-rolled mousedown
  // listener would have fought it, the same way AccountNav's did.

  async function respond(invitation: LeagueInvitationInboxItem, response: "accepted" | "declined") {
    setBusyId(invitation.invitationId);
    setError("");
    try {
      const slug = await respondToLeagueInvitation(invitation.invitationId, response);
      setInvitations((current) => current.filter((item) => item.invitationId !== invitation.invitationId));
      if (response === "accepted" && slug) {
        setOpen(false);
        router.push(`/leagues/${slug}`);
        router.refresh();
      }
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : "Unable to respond to invitation.");
    } finally {
      setBusyId(null);
    }
  }

  const count = invitations.length;

  return (
    <Popover
      label="League Invitations"
      triggerLabel={count > 0 ? `League invitations (${count} pending)` : "League invitations"}
      triggerIcon="mail"
      badgeCount={count}
      placement="bottom-end"
      open={open}
      onOpenChange={setOpen}
    >
      <Section
        title="League Invitations"
        description="Joining assigns any team reserved for you."
      >
        {count === 0 ? (
          <EmptyState title="No pending invitations" description="League invites will appear here." />
        ) : (
          <div className="space-y-2">
            {invitations.map((invitation) => (
              <Panel
                key={invitation.invitationId}
                footer={
                  <>
                    <Button
                      variant="tertiary"
                      scope="product"
                      disabled={busyId === invitation.invitationId}
                      onClick={() => void respond(invitation, "declined")}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="primary"
                      scope="product"
                      loading={busyId === invitation.invitationId}
                      disabled={busyId === invitation.invitationId}
                      onClick={() => void respond(invitation, "accepted")}
                    >
                      {busyId === invitation.invitationId ? "Joining…" : "Join League"}
                    </Button>
                  </>
                }
              >
                <div className="flex items-center gap-3">
                  <TeamMark
                    src={invitation.teamLogoUrl || invitation.leagueLogoUrl}
                    name={invitation.leagueName}
                    size="medium"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{invitation.leagueName}</p>
                    <p className="truncate text-xs text-slate-400">
                      {invitation.teamName ? `Team: ${invitation.teamName}` : "League member invitation"}
                    </p>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}

        {error && (
          <InlineNotice status="danger" title="Invitation error">
            {error}
          </InlineNotice>
        )}
      </Section>
    </Popover>
  );
}
