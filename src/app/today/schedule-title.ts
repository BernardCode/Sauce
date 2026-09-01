export function formatScheduleTitle(title: string): string {
  const withoutFiller = title.replace(
    /^(?:complete|finish|work on)\s+(?:the\s+)?/i,
    "",
  );
  const abbreviated = withoutFiller.replace(
    /\bUnit\s+(\d+[A-Za-z]?)\b/gi,
    "U$1",
  );
  const compact = abbreviated.replace(/\s+/g, " ").trim();
  return compact.replace(/^[a-z]/, (letter) => letter.toUpperCase());
}
