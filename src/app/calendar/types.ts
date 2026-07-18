export type CalendarBlock = {
  id: string;
  itemId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  locked: boolean;
  done: boolean;
  reason: string | null;
};

export type CalendarEvent = {
  id: string;
  sourceId: string;
  title: string;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
};

export type CalendarItem = {
  id: string;
  title: string;
  dueAt: string | null;
  estMinutes: number | null;
  remainingMinutes: number | null;
};

export type CalendarSource = {
  id: string;
  label: string;
  enabled: boolean;
};

export type CalendarHabit = {
  id: string;
  habitId: string;
  name: string;
  date: string;
  scheduledTime: string;
  done: boolean;
};
