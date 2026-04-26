/** Conditionally compose className strings. Tiny replacement for `clsx`. */
export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(' ');
}

/** Format a recipe time in minutes as "1 h 15 min" or "20 min" or em-dash if null. */
export function formatTime(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "Beef Stew" → "beef stew" — used everywhere we compare titles or tag names. */
export function normalise(s: string): string {
  return s.trim().toLowerCase();
}

/** "vegetarian" → "Vegetarian" — display form for tags. */
export function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
