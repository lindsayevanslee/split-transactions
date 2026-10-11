// Helpers for <input type="date">, whose value is a "YYYY-MM-DD" string in
// the user's local time zone (unlike Date#toISOString, which is UTC and can
// be a day off in the evening).

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Parses a "YYYY-MM-DD" value into a Date at local noon, so the day stays
 * the same for group members a few time zones away. Returns null for
 * anything that isn't a real calendar date.
 */
export function fromDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}
