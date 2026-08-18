export type ParsedQuickAdd = {
  title: string;
  dueAt: Date | null;
  estMinutes: number | null;
  isProject?: true;
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
  | { kind: "weekday"; weekday: number; forceNext?: boolean }
  | { kind: "monthDay"; month: number; day: number; year?: number }
  | { kind: "dayOfMonth"; day: number };

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

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
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
  const isProject = trimmed.startsWith("*");
  const content = isProject ? trimmed.slice(1).trimStart() : trimmed;
  const tokens = tokenize(content);

  let estMinutes: number | null = null;
  let dueAt: Date | null = null;
  // Start index in `trimmed` of the earliest consumed tail token. Slicing at
  // this point keeps the unconsumed part of the input in the title verbatim.
  let cut = content.length;

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

  const parsedTitle = content.slice(0, cut).trimEnd();
  const containsOnlyMetadata = parsedTitle === "" && content !== "";

  return {
    title: containsOnlyMetadata ? content : parsedTitle,
    dueAt: containsOnlyMetadata ? null : dueAt,
    estMinutes: containsOnlyMetadata ? null : estMinutes,
    ...(isProject ? { isProject: true as const } : {}),
  };
}

export function parseDueText(
  input: string,
  now: Date = new Date(),
): Date | null {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");
  if (normalized === "") return null;

  const extracted = extractTime(normalized);
  const time = extracted?.time ?? END_OF_DAY;
  const dayText = (extracted?.remaining ?? normalized)
    .replace(/\b(?:at|by|due|on|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const day = dayText === ""
    ? { kind: "today" as const }
    : parseFlexibleDay(dayText);
  if (day === null) return null;

  return resolveDue(day, time, now);
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
    let hours = Number(twentyFourHour[1]);
    const minutes = Number(twentyFourHour[2]);
    if (hours > 23 || minutes > 59) {
      return null;
    }
    // Bare school deadlines normally mean morning. Schoology's common
    // 11:59 deadline is the useful exception and means the end of the day.
    if (hours === 11 && minutes === 59) hours = 23;
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

function parseFlexibleDay(value: string): DaySpec | null {
  const relative = /^(?:(next|this)\s+)?([a-z]+)$/.exec(value);
  if (relative) {
    const basic = parseDayToken(relative[2]);
    if (basic?.kind === "weekday") {
      return {
        ...basic,
        ...(relative[1] === "next" ? { forceNext: true } : {}),
      };
    }
    if (relative[1] === undefined && basic !== null) return basic;
  }

  const isoDate = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (isoDate) {
    return calendarDay(
      Number(isoDate[2]),
      Number(isoDate[3]),
      Number(isoDate[1]),
    );
  }

  const numericDate = /^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?$/.exec(value);
  if (numericDate) {
    const year = numericDate[3] === undefined
      ? undefined
      : normalizeYear(Number(numericDate[3]));
    return calendarDay(Number(numericDate[1]), Number(numericDate[2]), year);
  }

  const monthFirst = /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/.exec(value);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1]];
    if (month === undefined) return null;
    return calendarDay(
      month,
      Number(monthFirst[2]),
      monthFirst[3] === undefined ? undefined : Number(monthFirst[3]),
    );
  }

  const dayFirst = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/.exec(value);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2]];
    if (month === undefined) return null;
    return calendarDay(
      month,
      Number(dayFirst[1]),
      dayFirst[3] === undefined ? undefined : Number(dayFirst[3]),
    );
  }

  const dayOnly = /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(value);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    return day >= 1 && day <= 31 ? { kind: "dayOfMonth", day } : null;
  }

  return null;
}

function calendarDay(
  month: number,
  day: number,
  year?: number,
): DaySpec | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { kind: "monthDay", month, day, ...(year === undefined ? {} : { year }) };
}

function normalizeYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

function extractTime(value: string): {
  remaining: string;
  time: TimeOfDay;
} | null {
  const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i;
  const matches = [...value.matchAll(new RegExp(timePattern, "gi"))];

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const hasClockMarker = match[2] !== undefined || match[3] !== undefined;
    if (!hasClockMarker || match.index === undefined) continue;
    const compact = `${match[1]}${match[2] === undefined ? "" : `:${match[2]}`}${
      match[3]?.replace(/\./g, "") ?? ""
    }`;
    const time = parseTime(compact);
    if (time === null) continue;
    return {
      remaining: `${value.slice(0, match.index)} ${value.slice(match.index + match[0].length)}`,
      time,
    };
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

  if (/^(?:am|pm)$/i.test(last.text) && previous !== null) {
    const separatedTime = parseTime(`${previous.text}${last.text}`);
    if (separatedTime !== null) {
      const dayToken = i > 1 ? tokens[i - 2] : null;
      const separatedDay = dayToken === null ? null : parseDayToken(dayToken.text);
      const dueAt = resolveDue(
        separatedDay ?? { kind: "today" },
        separatedTime,
        now,
      );
      if (dueAt !== null) {
        return {
          dueAt,
          tokenCount: separatedDay === null ? 2 : 3,
          start: separatedDay === null ? previous.start : dayToken!.start,
        };
      }
    }
  }

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
      let delta = (day.weekday - now.getDay() + 7) % 7;
      if (day.forceNext) delta = delta === 0 ? 7 : delta + 7;
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
      const year = day.year ?? now.getFullYear() + (passed ? 1 : 0);
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
    case "dayOfMonth": {
      let month = now.getMonth();
      let year = now.getFullYear();
      if (day.day < now.getDate()) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
      const candidate = new Date(
        year,
        month,
        day.day,
        t.hours,
        t.minutes,
        0,
        0,
      );
      if (candidate.getMonth() !== month || candidate.getDate() !== day.day) {
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
