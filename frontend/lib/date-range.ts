/**
 * Boundaries of a calendar day (`YYYY-MM-DD` from an `<input type="date">`) in
 * the user's own timezone, as ISO timestamps. Sending the bare date makes the
 * backend read it as midnight UTC, which drops the last day of a range.
 */
export function startOfDayISO(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

export function endOfDayISO(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}
