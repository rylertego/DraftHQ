export function moveDraftTeam<T>(
  teams: readonly T[],
  index: number,
  offset: -1 | 1
) {
  const targetIndex = index + offset;
  if (index < 0 || index >= teams.length || targetIndex < 0 || targetIndex >= teams.length) {
    return [...teams];
  }

  const reordered = [...teams];
  [reordered[index], reordered[targetIndex]] = [
    reordered[targetIndex],
    reordered[index],
  ];
  return reordered;
}
