export function getDraftConfig() {
  const draft = localStorage.getItem("draftConfig");

  if (!draft) {
    return null;
  }

  return JSON.parse(draft);
}

export function getDraftTeams(): string[] {
  const teams = localStorage.getItem("draftTeams");

  if (!teams) {
    return [];
  }

  return JSON.parse(teams);
}