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
  it('keeps the exact Tuesday-Friday five day columns', () => {
    expect(workforceDaySlots.map((slot) => slot.label)).toEqual([
      '07:30–09:00',
      '09:00–10:30',
      '10:30–12:00',
      '13:30–15:30',
      '15:30–17:30',
    ]);
  });

  it('ends the Monday schedule at 17:00', () => {
    expect(workforceDaySlotsFor('2026-09-28').map((slot) => slot.label)).toEqual([
      '07:30–09:00',
      '09:00–10:30',
      '10:30–12:00',
      '13:30–15:30',
      '15:30–17:00',
    ]);
    expect(workforceDaySlotsFor('2026-09-29').at(-1)?.label).toBe('15:30–17:30');
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
        endMinutes: clockToMinutes('13:30'),
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
    expect(plannedMinutes({ startMinutes: 810, endMinutes: 930 })).toBe(120);
  });

  it('rejects malformed clock values', () => {
    expect(() => clockToMinutes('25:00')).toThrow('Hora inválida.');
    expect(() => clockToMinutes('7:30')).toThrow('Hora inválida.');
  });
});
