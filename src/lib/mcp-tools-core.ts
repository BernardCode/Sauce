export function defaultPlanningRange(now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return {
    from_date: start.toISOString().slice(0, 10),
    to_date: end.toISOString().slice(0, 10),
  };
}
