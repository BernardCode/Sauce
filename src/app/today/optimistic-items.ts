import type { TodayItem } from "./task-types";

export type OptimisticItemChange =
  | { type: "add"; item: TodayItem }
  | { type: "complete"; id: string }
  | { type: "move"; id: string; destination: "main" | "later" };

export function updateOptimisticItems(
  current: TodayItem[],
  change: OptimisticItemChange,
): TodayItem[] {
  if (change.type === "add") return [...current, change.item];
  if (change.type === "complete") {
    return current.filter((item) => item.id !== change.id);
  }
  return current.map((item) =>
    item.id === change.id
      ? { ...item, isLater: change.destination === "later" }
      : item,
  );
}
