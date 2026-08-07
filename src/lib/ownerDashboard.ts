// The league dashboard was built commissioner-first: readiness percentages, open
// setup items, and a "next commissioner action" panel. Nine of ten people in a
// league can act on none of that. This module derives the owner-facing view of
// the same league state — what *they* need on draft night — as pure logic so it
// can be tested without rendering the dashboard.

export type OwnerDraftStatus = "setup" | "active" | "paused" | "complete" | null;
export type OwnerViewTone = "neutral" | "live" | "ready" | "warning" | "complete";

export interface OwnerDashboardInput {
  /** Whether this season has a draft at all. */
  draftExists: boolean;
  draftStatus: OwnerDraftStatus;
  /** Pre-formatted for display; the caller owns locale formatting. */
  formattedDraftDate: string | null;
  /** The viewer owns a league team. */
  hasTeam: boolean;
  teamName: string | null;
  /** 1-based draft slot, or null when the order is not set yet. */
  draftSlot: number | null;
  teamCount: number;
}

export interface OwnerDashboardView {
  statusLabel: string;
  statusTone: OwnerViewTone;
  /** One-sentence summary that replaces the commissioner setup narration. */
  headline: string;
  teamLabel: string;
  teamState: string;
  teamAssigned: boolean;
  slotLabel: string;
  /**
   * Owners always get a button. `room` whenever a draft exists — the lobby is
   * designed for pre-draft — otherwise the league team list.
   */
  primaryCta: { label: string; target: "room" | "teams" };
  /** Extra guidance when something is still out of the owner's hands. */
  note: string | null;
}

export function buildOwnerDashboardView(input: OwnerDashboardInput): OwnerDashboardView {
  const { draftExists, draftStatus, formattedDraftDate, hasTeam, teamName, draftSlot, teamCount } = input;
  const scheduled = Boolean(formattedDraftDate);

  let statusLabel: string;
  let statusTone: OwnerViewTone;
  let headline: string;

  if (!draftExists) {
    statusLabel = "Draft Not Created";
    statusTone = "warning";
    headline = "Your commissioner hasn't opened this season's draft yet. The countdown appears here as soon as it does.";
  } else if (draftStatus === "complete") {
    statusLabel = "Draft Complete";
    statusTone = "complete";
    headline = "Your draft is in the books. Review the board, your roster, and how every pick graded out.";
  } else if (draftStatus === "active") {
    statusLabel = "Draft Live";
    statusTone = "live";
    headline = "Draft night is happening right now. Get into the room.";
  } else if (draftStatus === "paused") {
    statusLabel = "Draft Paused";
    statusTone = "warning";
    headline = "The draft is paused. Stay in the room — the clock restarts when the commissioner resumes.";
  } else if (scheduled) {
    statusLabel = "Draft Scheduled";
    statusTone = "ready";
    headline = `Draft night is scheduled for ${formattedDraftDate}.`;
  } else {
    statusLabel = "Date TBD";
    statusTone = "warning";
    headline = "Your commissioner hasn't locked the date yet. You'll see the countdown here once it's set.";
  }

  const primaryCta: OwnerDashboardView["primaryCta"] = !draftExists
    ? { label: "View League Teams", target: "teams" }
    : draftStatus === "complete"
      ? { label: "Review Draft", target: "room" }
      : draftStatus === "active" || draftStatus === "paused"
        ? { label: "Join Draft Room", target: "room" }
        : { label: "Enter Draft Room", target: "room" };

  const slotLabel = draftSlot === null
    ? "TBD"
    : teamCount > 0
      ? `${draftSlot} of ${teamCount}`
      : String(draftSlot);

  const note = !hasTeam
    ? "You're not assigned to a team yet. Ask your commissioner to put you on one before draft night."
    : draftSlot === null && draftStatus !== "complete"
      ? "Your draft slot is set when the commissioner finalizes the order."
      : null;

  return {
    statusLabel,
    statusTone,
    headline,
    teamLabel: hasTeam ? (teamName ?? "Your team") : "No team yet",
    teamState: hasTeam ? "Assigned to you" : "Awaiting assignment",
    teamAssigned: hasTeam,
    slotLabel,
    primaryCta,
    note,
  };
}
