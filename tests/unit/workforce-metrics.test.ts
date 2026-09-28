import { describe, expect, it } from 'vitest';
import {
  occupancyLabel,
  shouldCountInMetrics,
  timeSignalFromBusinessSeconds,
} from '@/modules/workforce/domain/workforce-metrics';

describe('workforce metrics', () => {
  it('activates the operational signal only after one hour', () => {
    expect(timeSignalFromBusinessSeconds(3600)).toBe('NORMAL');
    expect(timeSignalFromBusinessSeconds(3601)).toBe('OVER_60_MINUTES');
  });

  it('uses semantic occupancy labels instead of color-only meaning', () => {
    expect(occupancyLabel('AVAILABLE')).toBe('Disponible');
    expect(occupancyLabel('OUT_OF_SCHEDULE')).toBe('Fuera de jornada');
  });

  it('supports explicit profile exclusions without name matching', () => {
    expect(
      shouldCountInMetrics({
        excludeFromOccupancyMetrics: true,
        excludeFromTimeMetrics: true,
      }),
    ).toBe(false);
    expect(
      shouldCountInMetrics({
        excludeFromOccupancyMetrics: false,
        excludeFromTimeMetrics: false,
      }),
    ).toBe(true);
  });
});
