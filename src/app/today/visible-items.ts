type TodayVisibilityItem = {
  id: string;
  due_at: string | null;
  planned_date: string | null;
};

export function isVisibleToday(
  item: TodayVisibilityItem,
  today: string,
  scheduledItemIds: ReadonlySet<string>,
): boolean {
  if (scheduledItemIds.has(item.id) || item.planned_date === today) {
    return true;
  }

  // A schedule block expiring must not make unfinished work disappear.
  return item.planned_date === null || item.planned_date < today;
}
