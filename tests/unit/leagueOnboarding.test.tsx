import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/draftApi", () => ({
  getSleeperLeaguePreview: vi.fn(),
}));

vi.mock("@/lib/leagueApi", () => ({
  importLeagueTeams: vi.fn(),
}));

vi.mock("@/lib/providerApi", () => ({
  getEspnLeaguePreview: vi.fn(),
  getYahooAuthUrl: vi.fn(),
  getYahooLeaguePreview: vi.fn(),
}));

import { LeagueImportFlow } from "@/components/LeagueImportModal";
import {
  leagueImportPath,
  shouldShowLeagueSourceSetup,
  slugFromLeagueName,
} from "@/lib/leagueOnboarding";

describe("league onboarding", () => {
  it("derives the league slug from the league name", () => {
    expect(slugFromLeagueName("Southcoast Gentlemen & Scholars")).toBe(
      "southcoast-gentlemen-scholars"
    );
    expect(slugFromLeagueName("  The 2026 League!!!  ")).toBe("the-2026-league");
  });

  it("routes new leagues into the import setup step", () => {
    expect(leagueImportPath("southcoast-gentlemen-scholars")).toBe(
      "/leagues/southcoast-gentlemen-scholars/import"
    );
  });

  it("keeps source setup available until a provider connection exists", () => {
    expect(shouldShowLeagueSourceSetup(null)).toBe(true);
    expect(shouldShowLeagueSourceSetup("sleeper")).toBe(false);
    expect(shouldShowLeagueSourceSetup("espn")).toBe(false);
    expect(shouldShowLeagueSourceSetup("yahoo")).toBe(false);
  });

  it("renders provider import choices outside the dialog shell", () => {
    const html = renderToStaticMarkup(
      <LeagueImportFlow
        leagueId="league-1"
        availableSlots={10}
        onImported={() => {}}
      />
    );

    expect(html).toContain("Sleeper");
    expect(html).toContain("ESPN");
    expect(html).toContain("Yahoo");
  });
});
