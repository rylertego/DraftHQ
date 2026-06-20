import { describe, expect, it } from "vitest";
import {
  normalizeTeam,
  transformNflversePlayers,
} from "../../scripts/import-nflverse-players.mjs";

describe("normalizeTeam", () => {
  it("normalizes current and historical aliases", () => {
    expect(normalizeTeam("JAC")).toBe("JAX");
    expect(normalizeTeam("OAK")).toBe("LV");
    expect(normalizeTeam("BUF")).toBe("BUF");
    expect(normalizeTeam("")).toBeNull();
  });
});

describe("transformNflversePlayers", () => {
  const rows = [
    {
      gsis_id: "00-1",
      display_name: "Current Quarterback",
      position: "QB",
      latest_team: "JAC",
      status: "ACT",
      last_season: "2026",
    },
    {
      gsis_id: "00-2",
      display_name: "Current Receiver",
      position: "WR",
      latest_team: "BUF",
      status: "RES",
      last_season: "2026",
    },
    {
      gsis_id: "00-3",
      display_name: "Released Runner",
      position: "RB",
      latest_team: "DAL",
      status: "CUT",
      last_season: "2026",
    },
    {
      gsis_id: "00-4",
      display_name: "Historical Tight End",
      position: "TE",
      latest_team: "NE",
      status: "ACT",
      last_season: "2025",
    },
    {
      gsis_id: "00-5",
      display_name: "Current Defender",
      position: "LB",
      latest_team: "MIA",
      status: "ACT",
      last_season: "2026",
    },
  ];

  it("keeps current fantasy players and adds every DST", () => {
    const result = transformNflversePlayers(rows);

    expect(result.season).toBe(2026);
    expect(result.sourceRowCount).toBe(5);
    expect(result.players).toHaveLength(34);
    expect(result.players).toContainEqual({
      external_id: "00-1",
      full_name: "Current Quarterback",
      position: "QB",
      nfl_team: "JAX",
    });
    expect(result.players).toContainEqual({
      external_id: "DST-BUF",
      full_name: "Buffalo Bills",
      position: "DST",
      nfl_team: "BUF",
    });
    expect(
      result.players.some((player) => player.external_id === "00-3")
    ).toBe(false);
    expect(
      result.players.some((player) => player.external_id === "00-4")
    ).toBe(false);
    expect(
      result.players.some((player) => player.external_id === "00-5")
    ).toBe(false);
  });

  it("deduplicates players by GSIS ID", () => {
    const result = transformNflversePlayers([
      ...rows,
      {
        ...rows[0],
        display_name: "Updated Quarterback",
      },
    ]);

    expect(
      result.players.filter((player) => player.external_id === "00-1")
    ).toEqual([
      {
        external_id: "00-1",
        full_name: "Updated Quarterback",
        position: "QB",
        nfl_team: "JAX",
      },
    ]);
  });
});
