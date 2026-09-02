export type TodayItem = {
  id: string;
  title: string;
  course: string | null;
  dueAt: string | null;
  plannedDate: string | null;
  estMinutes: number | null;
  isProject: boolean;
  isLater: boolean;
  isOverdue: boolean;
  origin: string;
  optimistic?: boolean;
};

export type AddItemResult = {
  error: string | null;
  warning?: string | null;
  item?: TodayItem;
};
