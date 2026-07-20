import type { TodayItem } from "./task-types";

export type OptimisticItemChange =
  | { type: "add"; item: TodayItem }
  | { type: "complete"; id: string };

export function updateOptimisticItems(
  current: TodayItem[],
  change: OptimisticItemChange,
): TodayItem[] {
  if (change.type === "add") return [...current, change.item];
  return current.filter((item) => item.id !== change.id);
}
