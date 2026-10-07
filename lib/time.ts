import { UserError } from '@/lib/errors';

// Business time zone is GMT+8 (Asia/Makassar, WITA, no daylight saving). See PRD 8.1.
const NAIVE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;

/**
 * Datetime inputs from the UI ("2026-10-02T16:00") carry no offset. Interpret them as GMT+8
 * explicitly instead of relying on the database session time zone.
 */
export function toWita(value?: string | null): string | null {
  if (!value) return null;
  if (NAIVE.test(value)) {
    const s = value.replace(' ', 'T');
    return (s.length === 16 ? `${s}:00` : s) + '+08:00';
  }
  if (Number.isNaN(Date.parse(value))) throw new UserError('Invalid date/time');
  return value; // already has an explicit offset
}

const pad = (n: number) => String(n).padStart(2, '0');
const shifted = (d = new Date()) => new Date(d.getTime() + 8 * 3600 * 1000); // UTC fields now show GMT+8 wall time

/** Today's date (YYYY-MM-DD) in GMT+8. */
export function witaToday(d = new Date()): string {
  return shifted(d).toISOString().slice(0, 10);
}

/** Current GMT+8 wall time formatted for <input type="datetime-local">. */
export function nowWitaInput(d = new Date()): string {
  return shifted(d).toISOString().slice(0, 16);
}

/** Tomorrow in GMT+8 at the given HH:mm, formatted for <input type="datetime-local">. */
export function tomorrowWitaInput(time = '16:00', d = new Date()): string {
  return `${witaToday(new Date(d.getTime() + 24 * 3600 * 1000))}T${time}`;
}

/** First and last day of the previous calendar month in GMT+8 (default payroll period). */
export function previousMonthRangeWita(d = new Date()): { start: string; end: string } {
  const s = shifted(d);
  const y = s.getUTCFullYear();
  const m = s.getUTCMonth(); // 0-based current month
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  const f = (x: Date) => `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  return { start: f(first), end: f(last) };
}
