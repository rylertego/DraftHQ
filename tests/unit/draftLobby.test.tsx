import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DraftLobby from "@/components/DraftLobby";
import type { Draft, DraftParticipant, Team } from "@/types/draft";

vi.mock("@/lib/draftApi", () => ({
  assignTeam: vi.fn(),
  removeDraftParticipant: vi.fn(),
}));

const draft: Draft = {
  id: "draft-1",
  name: "Test League 2026 Draft",
  joinCode: "ABCD12",
  commissionerUserId: "commissioner-user",
  leagueId: "league-1",
  teamCount: 2,
  rounds: 15,
  currentPick: 1,
  status: "setup",
  pickSeconds: 60,
  pickDeadlineAt: null,
  pausedRemainingSeconds: null,
  timerBehavior: "nothing",
  clockExtensionSeconds: 30,
  maxClockExtensions: 1,
  clockExtensionsUsed: 0,
  sleeperLeagueId: null,
  sleeperDraftId: null,
  scheduledAt: null,
  scheduledTimezone: null,
  rosterPositions: null,
  scoringType: "ppr",
  useLandmines: false,
  landmineCount: 0,
  hidePlayerRankings: false,
  sfx1Url: null,
  sfx2Url: null,
  posReactions: null,
  negReactions: null,
  pickIsInEnabled: false,
  pickIsInSfxUrl: null,
  draftStartAudioUrl: null,
  showRoundSlide: false,
  roundSlideSeconds: 8,
  roundSlidePausesClock: false,
  announcerVoiceUri: null,
  walkUpMusicMode: "restart",
  awardsSong: null,
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

const teams: Team[] = [
  {
    id: "team-1",
    draftId: "draft-1",
    name: "Aces",
    draftPosition: 1,
  },
  {
    id: "team-2",
    draftId: "draft-1",
    name: "Beacons",
    draftPosition: 2,
  },
];

const participants: DraftParticipant[] = [
  {
    id: "participant-commissioner",
    draftId: "draft-1",
    userId: "commissioner-user",
    teamId: "team-1",
    displayName: "Commissioner",
    role: "commissioner",
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  },
  {
    id: "participant-guest",
    draftId: "draft-1",
    userId: "guest-user",
    teamId: null,
    displayName: "Guest Owner",
    role: "owner",
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  },
];

describe("DraftLobby", () => {
  function renderLobby(overrides: Partial<ComponentProps<typeof DraftLobby>> = {}) {
    return renderToStaticMarkup(
      <DraftLobby
        draft={draft}
        participants={participants}
        teams={teams}
        onlineUserIds={["commissioner-user", "guest-user"]}
        currentUserId="commissioner-user"
        leagueSlug="test-league"
        isCommissioner
        isStarting={false}
        chatUnread={0}
        onChatToggle={() => undefined}
        onStart={() => undefined}
        {...overrides}
      />,
    );
  }

  it("gives commissioners a compact owner seating entry point before the draft starts", () => {
    const html = renderLobby();

    expect(html).toContain("Seat owners");
    expect(html).not.toContain("Owner Readiness");
    expect(html).not.toContain("Guest Owner");
  });

  it("keeps owner seating controls out of the participant lobby", () => {
    const html = renderLobby({
      currentUserId: "guest-user",
      isCommissioner: false,
    });

    expect(html).not.toContain("Owner Readiness");
    expect(html).not.toContain("Guest Owner");
    expect(html).not.toContain("Seat owners");
    expect(html).toContain("Waiting for the draft to start");
  });

  it("shows the empty-team setup state when no teams exist", () => {
    const html = renderLobby({
      teams: [],
      participants: [],
      onlineUserIds: ["commissioner-user"],
    });

    expect(html).toContain("The pre-draft lobby is waiting on teams");
    expect(html).toContain("Back to setup");
  });
});
