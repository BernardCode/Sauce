export type ParsedQuickAdd = {
  title: string;
  dueAt: Date | null;
  estMinutes: number | null;
};

// Deterministic quick-add parser. Reads an optional due date and estimate
// off the end of inputs like "chem lab writeup fri 5pm 90m". Anything it
// cannot read stays in the title and the item is created untimed, which is
// a fine failure. No AI in this loop.
export function parseQuickAdd(
  input: string,
  now: Date = new Date(),
): ParsedQuickAdd {
  void now; // used once the real parser lands on the parser branch
  return { title: input.trim(), dueAt: null, estMinutes: null };
}
