export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Makassar',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatTimeOnly(timeStr: string | null | undefined): string {
  if (!timeStr) return '—';
  return timeStr.slice(0, 5);
}

export const WEEKDAYS = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 7, name: 'Sunday', short: 'Sun' },
];

export function getWeekdayName(dayId: number): string {
  return WEEKDAYS.find((w) => w.id === dayId)?.name || `Day ${dayId}`;
}

// ---- GMT+8 (Asia/Makassar) helpers for form defaults ----
const WITA_OFFSET_MS = 8 * 3600 * 1000;
const witaShift = (d: Date) => new Date(d.getTime() + WITA_OFFSET_MS);

/** Current GMT+8 wall time for <input type="datetime-local">. */
export function nowWitaInput(): string {
  return witaShift(new Date()).toISOString().slice(0, 16);
}

/** Tomorrow in GMT+8 at HH:mm, for <input type="datetime-local">. */
export function tomorrowWitaInput(time = '16:00'): string {
  return `${witaShift(new Date(Date.now() + 24 * 3600 * 1000)).toISOString().slice(0, 10)}T${time}`;
}

/** First and last day of the previous calendar month in GMT+8 (default payroll period). */
export function previousMonthRangeWita(): { start: string; end: string } {
  const s = witaShift(new Date());
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return {
    start: fmt(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - 1, 1))),
    end: fmt(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 0))),
  };
}
