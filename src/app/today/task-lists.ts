import { isVisibleToday } from "./visible-items";

type ListItem = {
  id: string;
  due_at: string | null;
  planned_date: string | null;
};

export function partitionTodayItems<T extends ListItem>(
  items: T[],
  today: string,
  scheduledItemIds: ReadonlySet<string>,
  laterItemIds: ReadonlySet<string>,
): { main: T[]; later: T[] } {
  const main: T[] = [];
  const later: T[] = [];

  for (const item of items) {
    const scheduledToday = scheduledItemIds.has(item.id);
    if (laterItemIds.has(item.id) && !scheduledToday) {
      later.push(item);
    } else if (isVisibleToday(item, today, scheduledItemIds)) {
      main.push(item);
    }
  }

  return { main, later };
}
