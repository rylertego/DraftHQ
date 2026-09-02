import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type DraftConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export function subscribeToDraft(
  draftId: string,
  userId: string,
  onChange: () => void,
  onPresenceChange: (onlineUserIds: string[]) => void,
  onStatusChange: (status: DraftConnectionStatus) => void
) {
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
          Array<{ user_id?: string }>
        >;
        const onlineUserIds = new Set(
          Object.values(presenceState)
            .flat()
            .flatMap((presence) =>
              presence.user_id ? [presence.user_id] : []
            )
        );
        onPresenceChange([...onlineUserIds]);
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
        void channel?.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        });
        onChange();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onStatusChange("error");
      } else if (status === "CLOSED") {
        onStatusChange("disconnected");
      }
    });

  return () => {
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
      onPresenceChange([]);
    }
  };
}
