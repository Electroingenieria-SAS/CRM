import { describe, expect, it } from 'vitest';
import {
  inclusiveDateDays,
  percentileCont,
  stageBusinessSeconds,
} from '@/modules/analytics/domain/analytics-metrics';
import { parseCsv, recordsToCsv } from '@/modules/analytics/domain/csv';

describe('analytics KPI formula invariants', () => {
  it('separates waiting, processing, blocked and transit seconds', () => {
    expect(stageBusinessSeconds(3600, 7200, 1800, 900)).toEqual({
      waiting: 3600,
      processing: 5400,
      blocked: 1800,
      transit: 900,
      total: 11_700,
    });
  });

  it('does not accept blocked time greater than active time', () => {
    expect(() => stageBusinessSeconds(0, 900, 901)).toThrow(
      'blockedSeconds no puede superar activeSeconds.',
    );
  });

  it('matches continuous percentile interpolation used by PostgreSQL', () => {
    const values = [10, 20, 30, 40];
    expect(percentileCont(values, 0.5)).toBe(25);
    expect(percentileCont(values, 0.75)).toBe(32.5);
    expect(percentileCont(values, 0.9)).toBeCloseTo(37);
  });

  it('treats date filters as inclusive local calendar days', () => {
    expect(inclusiveDateDays('2026-09-01', '2026-09-01')).toBe(1);
    expect(inclusiveDateDays('2026-09-01', '2026-09-30')).toBe(30);
    expect(() => inclusiveDateDays('2026-09-30', '2026-09-01')).toThrow();
  });
});

describe('analytics CSV boundaries', () => {
  it('parses quoted CSV fields and embedded commas', () => {
    const rows = parseCsv('externalKey,orderNumber,clientName\r\nA-1,P-1,"Cliente, QA"');
    expect(rows).toEqual([{ externalKey: 'A-1', orderNumber: 'P-1', clientName: 'Cliente, QA' }]);
  });

  it('exports only the supplied rows using the selected columns', () => {
    const csv = recordsToCsv(
      [
        { key: 'order', label: 'Pedido' },
        { key: 'client', label: 'Cliente' },
      ],
      [{ order: 'P-1', client: 'Cliente "QA"' }],
    );
    expect(csv).toBe('Pedido,Cliente\r\nP-1,"Cliente ""QA"""');
  });
});
