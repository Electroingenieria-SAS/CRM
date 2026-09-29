import type { WorkforceDaySlot } from '@/modules/workforce/domain/workforce-types';

const weekdaySlots: readonly WorkforceDaySlot[] = [
  { key: '0730-0900', label: '07:30–09:00', startMinutes: 7 * 60 + 30, endMinutes: 9 * 60 },
  { key: '0900-1030', label: '09:00–10:30', startMinutes: 9 * 60, endMinutes: 10 * 60 + 30 },
  { key: '1030-1200', label: '10:30–12:00', startMinutes: 10 * 60 + 30, endMinutes: 12 * 60 },
  { key: '1330-1530', label: '13:30–15:30', startMinutes: 13 * 60 + 30, endMinutes: 15 * 60 + 30 },
  { key: '1530-1730', label: '15:30–17:30', startMinutes: 15 * 60 + 30, endMinutes: 17 * 60 + 30 },
];

const mondaySlots: readonly WorkforceDaySlot[] = [
  ...weekdaySlots.slice(0, 4),
  { key: '1530-1700', label: '15:30–17:00', startMinutes: 15 * 60 + 30, endMinutes: 17 * 60 },
];

export const workforceDaySlots = weekdaySlots;

export function workforceDaySlotsFor(day: string): readonly WorkforceDaySlot[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return weekdaySlots;

  const weekday = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  ).getUTCDay();

  return weekday === 1 ? mondaySlots : weekdaySlots;
}

export interface ScheduleSegment {
  readonly startMinutes: number;
  readonly endMinutes: number;
}

export function clockToMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Hora inválida.');

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('Hora inválida.');

  return hour * 60 + minute;
}

export function overlaps(first: ScheduleSegment, second: ScheduleSegment): boolean {
  return first.startMinutes < second.endMinutes && second.startMinutes < first.endMinutes;
}

export function slotIndexesFor(
  segment: ScheduleSegment,
  slots: readonly WorkforceDaySlot[] = workforceDaySlots,
): number[] {
  return slots.flatMap((slot, index) => (overlaps(segment, slot) ? [index] : []));
}

export function plannedMinutes(segment: ScheduleSegment): number {
  return Math.max(0, segment.endMinutes - segment.startMinutes);
}
