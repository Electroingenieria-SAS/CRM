import { describe, expect, it } from 'vitest';
import {
  clockToMinutes,
  overlaps,
  plannedMinutes,
  slotIndexesFor,
  workforceDaySlots,
  workforceDaySlotsFor,
} from '@/modules/workforce/domain/work-schedule';

describe('workforce official schedule', () => {
  it('keeps the exact five business-day columns', () => {
    expect(workforceDaySlots.map((slot) => slot.label)).toEqual([
      '07:00–09:00',
      '09:00–11:00',
      '11:00–12:00',
      '13:40–15:40',
      '15:40–17:30',
    ]);
  });

  it('uses the same official schedule Monday through Friday', () => {
    expect(workforceDaySlotsFor('2026-09-28').map((slot) => slot.label)).toEqual([
      '07:00–09:00',
      '09:00–11:00',
      '11:00–12:00',
      '13:40–15:40',
      '15:40–17:30',
    ]);
    expect(workforceDaySlotsFor('2026-09-29').at(-1)?.label).toBe('15:40–17:30');
  });

  it('maps an activity only to overlapping slots', () => {
    expect(
      slotIndexesFor({
        startMinutes: clockToMinutes('08:30'),
        endMinutes: clockToMinutes('11:30'),
      }),
    ).toEqual([0, 1, 2]);
    expect(
      slotIndexesFor({
        startMinutes: clockToMinutes('12:00'),
        endMinutes: clockToMinutes('13:40'),
      }),
    ).toEqual([]);
  });

  it('detects overlaps and durations', () => {
    expect(
      overlaps({ startMinutes: 450, endMinutes: 510 }, { startMinutes: 500, endMinutes: 540 }),
    ).toBe(true);
    expect(
      overlaps({ startMinutes: 450, endMinutes: 510 }, { startMinutes: 510, endMinutes: 550 }),
    ).toBe(false);
    expect(plannedMinutes({ startMinutes: 820, endMinutes: 940 })).toBe(120);
  });

  it('rejects malformed clock values', () => {
    expect(() => clockToMinutes('25:00')).toThrow('Hora inválida.');
    expect(() => clockToMinutes('7:30')).toThrow('Hora inválida.');
  });
});
