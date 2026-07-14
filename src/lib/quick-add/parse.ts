export type ParsedQuickAdd = {
  title: string;
  dueAt: Date | null;
  estMinutes: number | null;
};

type TokenSpan = {
  text: string;
  start: number;
};

type TimeOfDay = {
  hours: number;
  minutes: number;
};

type DaySpec =
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "weekday"; weekday: number }
  | { kind: "monthDay"; month: number; day: number };

const WEEKDAYS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

// Assignments are usually due at the end of the day, so a date with no time
// lands at 11:59pm rather than midnight.
const END_OF_DAY: TimeOfDay = { hours: 23, minutes: 59 };

// Deterministic quick-add parser. Reads an optional due date and estimate
// off the end of inputs like "chem lab writeup fri 5pm 90m". The two tail
// pieces can come in either order, and a time token must sit right next to
// its day token. Anything it cannot read stays in the title and the item is
// created untimed, which is a fine failure. No AI in this loop.
export function parseQuickAdd(
  input: string,
  now: Date = new Date(),
): ParsedQuickAdd {
  const trimmed = input.trim();
  const tokens = tokenize(trimmed);

  let estMinutes: number | null = null;
  let dueAt: Date | null = null;
  // Start index in `trimmed` of the earliest consumed tail token. Slicing at
  // this point keeps the unconsumed part of the input in the title verbatim.
  let cut = trimmed.length;

  let i = tokens.length - 1;
  while (i >= 0) {
    const token = tokens[i];

    if (estMinutes === null) {
      const est = parseEstimate(token.text);
      if (est !== null) {
        estMinutes = est;
        cut = token.start;
        i -= 1;
        continue;
      }
    }

    if (dueAt === null) {
      const group = readDateGroup(tokens, i, now);
      if (group !== null) {
        dueAt = group.dueAt;
        cut = group.start;
        i -= group.tokenCount;
        continue;
      }
    }

    // The token in front of the consumed tail is not readable, so everything
    // from here forward belongs to the title. Stop rather than skip.
    break;
  }

  return { title: trimmed.slice(0, cut).trimEnd(), dueAt, estMinutes };
}

function tokenize(trimmed: string): TokenSpan[] {
  const spans: TokenSpan[] = [];
  const matcher = /\S+/g;
  let match = matcher.exec(trimmed);
  while (match !== null) {
    spans.push({ text: match[0], start: match.index });
    match = matcher.exec(trimmed);
  }
  return spans;
}

// Accepts "90m", "45min", "2h", "1h30", "1h30m". Returns whole minutes, or
// null when the token is not an estimate or works out to zero.
function parseEstimate(token: string): number | null {
  const lower = token.toLowerCase();

  const minutesOnly = /^(\d+)(?:m|min)$/.exec(lower);
  if (minutesOnly) {
    return positiveOrNull(Number(minutesOnly[1]));
  }

  const hoursOnly = /^(\d+)h$/.exec(lower);
  if (hoursOnly) {
    return positiveOrNull(Number(hoursOnly[1]) * 60);
  }

  const hoursAndMinutes = /^(\d+)h(\d+)m?$/.exec(lower);
  if (hoursAndMinutes) {
    return positiveOrNull(
      Number(hoursAndMinutes[1]) * 60 + Number(hoursAndMinutes[2]),
    );
  }

  return null;
}

function positiveOrNull(minutes: number): number | null {
  return minutes > 0 ? minutes : null;
}

// Accepts "5pm", "11:59pm", "9:30am", "17:00". A bare number is never a
// time, otherwise "problem set 3" would grow a due date.
function parseTime(token: string): TimeOfDay | null {
  const lower = token.toLowerCase();

  const twelveHour = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(lower);
  if (twelveHour) {
    const rawHours = Number(twelveHour[1]);
    const minutes = twelveHour[2] === undefined ? 0 : Number(twelveHour[2]);
    if (rawHours < 1 || rawHours > 12 || minutes > 59) {
      return null;
    }
    // 12am is midnight and 12pm is noon, so 12 maps to 0 before adding.
    const hours = (rawHours % 12) + (twelveHour[3] === "pm" ? 12 : 0);
    return { hours, minutes };
  }

  const twentyFourHour = /^(\d{1,2}):(\d{2})$/.exec(lower);
  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = Number(twentyFourHour[2]);
    if (hours > 23 || minutes > 59) {
      return null;
    }
    return { hours, minutes };
  }

  return null;
}

function parseDayToken(token: string): DaySpec | null {
  const lower = token.toLowerCase();

  if (lower === "today") {
    return { kind: "today" };
  }
  if (lower === "tomorrow") {
    return { kind: "tomorrow" };
  }

  const weekday = WEEKDAYS[lower];
  if (weekday !== undefined) {
    return { kind: "weekday", weekday };
  }

  const monthDay = /^(\d{1,2})\/(\d{1,2})$/.exec(lower);
  if (monthDay) {
    const month = Number(monthDay[1]);
    const day = Number(monthDay[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    return { kind: "monthDay", month, day };
  }

  return null;
}

type DateGroup = {
  dueAt: Date;
  tokenCount: number;
  start: number;
};

// Reads a date group ending at tokens[i]: a day token with an optional time
// token immediately before or after it, or a time token on its own. Returns
// null when tokens[i] starts no readable group.
function readDateGroup(
  tokens: TokenSpan[],
  i: number,
  now: Date,
): DateGroup | null {
  const last = tokens[i];
  const previous = i > 0 ? tokens[i - 1] : null;

  const day = parseDayToken(last.text);
  if (day !== null) {
    const timeBefore = previous === null ? null : parseTime(previous.text);
    if (timeBefore !== null && previous !== null) {
      const dueAt = resolveDue(day, timeBefore, now);
      if (dueAt !== null) {
        return { dueAt, tokenCount: 2, start: previous.start };
      }
    }
    const dueAt = resolveDue(day, null, now);
    if (dueAt !== null) {
      return { dueAt, tokenCount: 1, start: last.start };
    }
    return null;
  }

  const time = parseTime(last.text);
  if (time !== null) {
    const dayBefore = previous === null ? null : parseDayToken(previous.text);
    if (dayBefore !== null && previous !== null) {
      const dueAt = resolveDue(dayBefore, time, now);
      if (dueAt !== null) {
        return { dueAt, tokenCount: 2, start: previous.start };
      }
    }
    // A time with no day means today, even when that moment already passed.
    // Better an overdue item than a silently dropped time.
    const dueAt = resolveDue({ kind: "today" }, time, now);
    if (dueAt !== null) {
      return { dueAt, tokenCount: 1, start: last.start };
    }
  }

  return null;
}

function resolveDue(
  day: DaySpec,
  time: TimeOfDay | null,
  now: Date,
): Date | null {
  const t = time ?? END_OF_DAY;

  switch (day.kind) {
    case "today":
      return atTime(now, 0, t);
    case "tomorrow":
      return atTime(now, 1, t);
    case "weekday": {
      const delta = (day.weekday - now.getDay() + 7) % 7;
      if (delta === 0) {
        // The named weekday is today. Keep it today only while the target
        // time is still ahead, otherwise the user means next week.
        const candidate = atTime(now, 0, t);
        return candidate.getTime() > now.getTime()
          ? candidate
          : atTime(now, 7, t);
      }
      return atTime(now, delta, t);
    }
    case "monthDay": {
      // Compared at date granularity: a month/day earlier in the calendar
      // than today rolls to next year, today or later stays in this year.
      const passed =
        day.month - 1 < now.getMonth() ||
        (day.month - 1 === now.getMonth() && day.day < now.getDate());
      const year = now.getFullYear() + (passed ? 1 : 0);
      const candidate = new Date(
        year,
        day.month - 1,
        day.day,
        t.hours,
        t.minutes,
        0,
        0,
      );
      // Date() rolls an invalid day into the next month (Feb 30 becomes
      // Mar 2). Treat rollover as a failed parse so the token stays in the
      // title instead of becoming a date nobody typed.
      if (
        candidate.getMonth() !== day.month - 1 ||
        candidate.getDate() !== day.day
      ) {
        return null;
      }
      return candidate;
    }
  }
}

// Builds a local Date at the given day offset from `now`. The Date
// constructor normalizes an out-of-range day of month, which handles month
// and year rollover without any date library.
function atTime(now: Date, dayOffset: number, time: TimeOfDay): Date {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    time.hours,
    time.minutes,
    0,
    0,
  );
}
