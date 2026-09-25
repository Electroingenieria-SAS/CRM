import { describe, expect, it } from 'vitest';
import { BUSINESS_TIME_ZONE, formatBusinessDate } from '@/shared/time/time-zone';

describe('business time zone', () => {
  it('centralizes Colombia business time', () => {
    expect(BUSINESS_TIME_ZONE).toBe('America/Bogota');
    expect(formatBusinessDate('2026-09-25T14:00:00Z')).toContain('9:00');
  });

  it('handles invalid input without throwing', () => {
    expect(formatBusinessDate('invalid')).toBe('Fecha inválida');
  });
});
