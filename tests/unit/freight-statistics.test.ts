import { describe, expect, it } from 'vitest';
import {
  classifyFreightEvidence,
  freightRecencyFactor,
  percentile,
  quartiles,
  removeIqrOutliers,
  weightedFreightEstimate,
} from '@/modules/freight/domain/statistics';

describe('freight robust statistics', () => {
  it('calculates interpolated median and quartiles', () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(quartiles([10, 20, 30, 40]).iqr).toBe(15);
  });

  it('removes an extreme IQR outlier without changing the source', () => {
    const source = [10_000, 11_000, 12_000, 13_000, 500_000];
    expect(removeIqrOutliers(source)).toEqual([10_000, 11_000, 12_000, 13_000]);
    expect(source).toHaveLength(5);
  });

  it('applies transparent recency weights', () => {
    expect(freightRecencyFactor(120)).toBe(1);
    expect(freightRecencyFactor(300)).toBe(0.85);
    expect(freightRecencyFactor(600)).toBe(0.65);
    expect(freightRecencyFactor(900)).toBe(0.4);
  });

  it('labels evidence without presenting it as probability', () => {
    expect(
      classifyFreightEvidence({
        scope: 'CITY',
        samples: 12,
        relativeSpread: 0.5,
        freshnessFactor: 1,
      }),
    ).toBe('HIGH');

    expect(
      classifyFreightEvidence({
        scope: 'NATIONAL',
        samples: 60,
        relativeSpread: 1.1,
        freshnessFactor: 0.85,
      }),
    ).toBe('MEDIUM');
  });
  it('builds a sample-weighted general destination reference', () => {
    expect(
      weightedFreightEstimate([
        { low: 10_000, mid: 20_000, high: 30_000, samples: 3 },
        { low: 20_000, mid: 30_000, high: 40_000, samples: 1 },
      ]),
    ).toEqual({ low: 12_500, mid: 22_500, high: 32_500, samples: 4 });
  });
});
