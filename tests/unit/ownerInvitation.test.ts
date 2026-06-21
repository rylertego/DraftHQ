import { describe, expect, it } from "vitest";
import { buildOwnerInvitationMessage } from "@/lib/ownerInvitation";

describe("buildOwnerInvitationMessage", () => {
  it("includes the reserved identity, team, draft, and join link", () => {
    expect(
      buildOwnerInvitationMessage({
        draftName: "Friday League",
        teamName: "Blue Team",
        email: "owner@example.com",
        joinUrl: "https://drafthq.test/join/ABC123",
      })
    ).toBe(
      "You are invited to Friday League in DraftHQ as Blue Team.\n" +
        "Open https://drafthq.test/join/ABC123\n" +
        "Log in or create an account with owner@example.com so DraftHQ can assign your team."
    );
  });
});
