export function dateInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function endOfDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
