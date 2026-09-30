import type { WorkforceDaySlot } from '@/modules/workforce/domain/workforce-types';

const weekdaySlots: readonly WorkforceDaySlot[] = [
  { key: '0700-0900', label: '07:00–09:00', startMinutes: 7 * 60, endMinutes: 9 * 60 },
  { key: '0900-1100', label: '09:00–11:00', startMinutes: 9 * 60, endMinutes: 11 * 60 },
  { key: '1100-1200', label: '11:00–12:00', startMinutes: 11 * 60, endMinutes: 12 * 60 },
  { key: '1340-1540', label: '13:40–15:40', startMinutes: 13 * 60 + 40, endMinutes: 15 * 60 + 40 },
  { key: '1540-1730', label: '15:40–17:30', startMinutes: 15 * 60 + 40, endMinutes: 17 * 60 + 30 },
];

export const workforceDaySlots = weekdaySlots;

export function workforceDaySlotsFor(_day: string): readonly WorkforceDaySlot[] {
  return weekdaySlots;
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
