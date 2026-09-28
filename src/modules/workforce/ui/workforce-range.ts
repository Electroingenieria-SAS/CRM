import { BUSINESS_TIME_ZONE } from '@/shared/time/time-zone';

export type WorkforceCalendarMode = 'day' | 'week' | 'month';

function isoDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function todayBusinessIso(): string {
  return isoDate(new Date());
}

function parseIso(value: string): Date {
  return new Date(`${value}T12:00:00-05:00`);
}

function parseYearMonth(value: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
  if (!match?.[1] || !match[2]) throw new Error('Fecha de calendario inválida.');

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('Fecha de calendario inválida.');

  return { year, month };
}

export function shiftIsoDate(value: string, days: number): string {
  const date = parseIso(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function workforceRange(mode: WorkforceCalendarMode, anchor: string) {
  const date = parseIso(anchor);

  if (mode === 'day') return { from: anchor, to: anchor };

  if (mode === 'week') {
    const weekday = date.getUTCDay();
    const isoWeekday = weekday === 0 ? 7 : weekday;
    const from = shiftIsoDate(anchor, 1 - isoWeekday);
    return { from, to: shiftIsoDate(from, 4) };
  }

  const { year, month } = parseYearMonth(anchor);
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: first,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function navigateWorkforceAnchor(
  mode: WorkforceCalendarMode,
  anchor: string,
  direction: -1 | 1,
): string {
  if (mode === 'day') return shiftIsoDate(anchor, direction);
  if (mode === 'week') return shiftIsoDate(anchor, direction * 7);

  const { year, month } = parseYearMonth(anchor);
  const target = new Date(Date.UTC(year, month - 1 + direction, 15));
  return isoDate(target);
}

export function businessDateLabel(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parseIso(value));
}

export function businessClockMinutes(value: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function businessIsoDate(value: string): string {
  return isoDate(new Date(value));
}
