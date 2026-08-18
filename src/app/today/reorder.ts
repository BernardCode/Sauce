export type DropPosition = "before" | "after";

export function reorderItemIds(
  itemIds: string[],
  draggedId: string,
  targetId: string,
  position: DropPosition,
): string[] {
  if (draggedId === targetId) return itemIds;

  const draggedIndex = itemIds.indexOf(draggedId);
  const targetIndex = itemIds.indexOf(targetId);
  if (draggedIndex === -1 || targetIndex === -1) return itemIds;

  const next = itemIds.filter((id) => id !== draggedId);
  const nextTargetIndex = next.indexOf(targetId);
  const insertionIndex =
    position === "after" ? nextTargetIndex + 1 : nextTargetIndex;
  next.splice(insertionIndex, 0, draggedId);
  return next;
}

export function applySavedOrder(
  fallbackItemIds: string[],
  savedItemIds: string[],
): string[] {
  const visibleIds = new Set(fallbackItemIds);
  const seen = new Set<string>();
  const orderedIds: string[] = [];

  for (const id of savedItemIds) {
    if (!visibleIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    orderedIds.push(id);
  }

  for (const id of fallbackItemIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    orderedIds.push(id);
  }

  return orderedIds;
}
