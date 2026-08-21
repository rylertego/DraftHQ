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

/**
 * Moves the team at `fromIndex` so it sits at `toIndex`, shifting everything
 * between them along.
 *
 * Distinct from {@link moveDraftTeam}, which swaps a team with its immediate
 * neighbour. A swap is right for an up/down button but wrong for a drag: drop
 * team 1 onto position 5 with a swap and teams 2-4 stay put while team 5 jumps
 * to the top, which is not what the person dragging saw.
 *
 * Out-of-range indices return a copy unchanged, matching moveDraftTeam.
 */
export function reorderDraftTeams<T>(
  teams: readonly T[],
  fromIndex: number,
  toIndex: number
) {
  if (
    fromIndex < 0 || fromIndex >= teams.length ||
    toIndex   < 0 || toIndex   >= teams.length ||
    fromIndex === toIndex
  ) {
    return [...teams];
  }

  const reordered = [...teams];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}
