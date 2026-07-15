"use client";

import type { TodayItem } from "./item-list";
import { formatDue, type DueTone } from "./relative-time";

const toneClass: Record<DueTone, string> = {
  overdue: "text-red-600 dark:text-red-400",
  soon: "text-amber-600 dark:text-amber-400",
  normal: "text-zinc-500",
};

// A fixed palette hashed by course name, so the same course always wears
// the same color without anyone configuring anything.
const pillPalettes = [
  "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
];

function CoursePill({ course }: { course: string }) {
  let hash = 0;
  for (let i = 0; i < course.length; i++) {
    hash = (hash * 31 + course.charCodeAt(i)) | 0;
  }
  const palette = pillPalettes[Math.abs(hash) % pillPalettes.length];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${palette}`}>
      {course}
    </span>
  );
}

type Props = {
  item: TodayItem;
  // Null until the client mounts, so due labels never hydrate mismatched.
  now: Date | null;
  leaving: boolean;
  onDone: (id: string) => void;
};

export function ItemCard({ item, now, leaving, onDone }: Props) {
  const due = item.dueAt && now ? formatDue(new Date(item.dueAt), now) : null;

  return (
    <li
      className={`flex items-start gap-3 rounded-lg border border-zinc-200 p-3 transition-all duration-300 dark:border-zinc-800 ${
        leaving ? "translate-x-2 opacity-0" : "opacity-100"
      }`}
    >
      <input
        type="checkbox"
        checked={leaving}
        disabled={leaving}
        onChange={() => onDone(item.id)}
        aria-label={`Mark "${item.title}" done`}
        className="mt-1 size-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.title}</span>
          {item.course ? <CoursePill course={item.course} /> : null}
        </div>
        {item.dueAt ? (
          // Non-breaking space holds the line height for the single frame
          // before the mounted clock exists.
          <span className={`text-xs ${due ? toneClass[due.tone] : "text-zinc-500"}`}>
            {due?.label ?? " "}
          </span>
        ) : null}
      </div>
    </li>
  );
}
