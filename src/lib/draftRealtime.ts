import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type DraftConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/** userId → the player that user currently has staged, if any. */
export type StagedByUserId = Record<string, string>;

export interface DraftSubscription {
  unsubscribe: () => void;
  /**
   * Republish this client's presence with the player it has staged.
   *
   * Staging rides on presence rather than a table because it is transient
   * intent, not draft state: it must never outlive the tab that set it, and it
   * must not be recoverable after a refresh. Presence drops it automatically
   * when the client goes away, which a row would not.
   */
  publishStagedPlayer: (playerId: string | null) => void;
}

interface DraftPresence {
  user_id?: string;
  staged_player_id?: string | null;
}

export function subscribeToDraft(
  draftId: string,
  userId: string,
  onChange: () => void,
  onPresenceChange: (onlineUserIds: string[]) => void,
  onStatusChange: (status: DraftConnectionStatus) => void,
  onStagedChange?: (stagedByUserId: StagedByUserId) => void,
  /** Read at (re)subscribe time so a reconnect republishes what is staged. */
  getStagedPlayerId?: () => string | null
): DraftSubscription {
  let stagedPlayerId: string | null = getStagedPlayerId?.() ?? null;

  const trackPayload = () => ({
    user_id: userId,
    online_at: new Date().toISOString(),
    staged_player_id: stagedPlayerId,
  });

  let channel: RealtimeChannel | null = supabase
    .channel(`draft-room:${draftId}`)
    .on(
      "presence",
      { event: "sync" },
      () => {
        if (!channel) {
          return;
        }

        const presenceState = channel.presenceState() as Record<
          string,
          DraftPresence[]
        >;
        const entries = Object.values(presenceState).flat();

        const onlineUserIds = new Set(
          entries.flatMap((presence) =>
            presence.user_id ? [presence.user_id] : []
          )
        );
        onPresenceChange([...onlineUserIds]);

        if (onStagedChange) {
          const staged: StagedByUserId = {};
          for (const presence of entries) {
            if (presence.user_id && presence.staged_player_id) {
              staged[presence.user_id] = presence.staged_player_id;
            }
          }
          onStagedChange(staged);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "drafts",
        filter: `id=eq.${draftId}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "teams",
        filter: `draft_id=eq.${draftId}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "draft_participants",
        filter: `draft_id=eq.${draftId}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "picks",
        filter: `draft_id=eq.${draftId}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "picks",
        filter: `draft_id=eq.${draftId}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "picks",
      },
      onChange
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        onStatusChange("connected");
        void channel?.track(trackPayload());
        onChange();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onStatusChange("error");
      } else if (status === "CLOSED") {
        onStatusChange("disconnected");
      }
    });

  return {
    unsubscribe: () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
        onPresenceChange([]);
        onStagedChange?.({});
      }
    },
    publishStagedPlayer: (playerId) => {
      if (stagedPlayerId === playerId) {
        return;
      }
      stagedPlayerId = playerId;
      // Before SUBSCRIBED there is nothing to track onto; the value is held and
      // the subscribe callback publishes it.
      void channel?.track(trackPayload());
    },
  };
}
