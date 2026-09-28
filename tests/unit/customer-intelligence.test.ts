import { describe, expect, it } from 'vitest';
import {
  buildPareto,
  calculateCustomerScores,
  classifyCustomer,
  effectiveInvoicePaid,
  orderPriorityForSegment,
  scoreCustomer,
} from '@/modules/customers/domain/customer-intelligence';

describe('customer intelligence domain', () => {
  it('uses only normalized order frequency and paid amount with 50/50 weights', () => {
    expect(scoreCustomer(100, 0)).toBe(50);
    expect(scoreCustomer(0, 100)).toBe(50);
    expect(scoreCustomer(100, 100)).toBe(100);
  });

  it('keeps the four configured business segments deterministic', () => {
    expect(classifyCustomer(29.99)).toBe('BASIC');
    expect(classifyCustomer(30)).toBe('NORMAL');
    expect(classifyCustomer(70)).toBe('PREMIUM');
    expect(classifyCustomer(90)).toBe('URGENT');
  });

  it('maps segments to future order priority without manual input', () => {
    expect(orderPriorityForSegment('BASIC')).toBe('LOW');
    expect(orderPriorityForSegment('NORMAL')).toBe('MEDIUM');
    expect(orderPriorityForSegment('PREMIUM')).toBe('HIGH');
    expect(orderPriorityForSegment('URGENT')).toBe('URGENT');
  });

  it('handles ties and outliers reproducibly', () => {
    const rows = calculateCustomerScores([
      { customerId: 'a', orderCount: 2, paidAmount: 100 },
      { customerId: 'b', orderCount: 2, paidAmount: 100 },
      { customerId: 'c', orderCount: 50, paidAmount: 1_000_000 },
    ]);

    expect(rows[0]?.score).toBe(rows[1]?.score);
    expect(rows[2]?.score).toBe(100);
  });

  it('uses a neutral midpoint when only one observed customer exists', () => {
    const [row] = calculateCustomerScores([
      { customerId: 'only', orderCount: 1, paidAmount: 0 },
    ]);

    expect(row?.frequencyPercentile).toBe(50);
    expect(row?.paidPercentile).toBe(50);
    expect(row?.score).toBe(50);
    expect(row?.segment).toBe('NORMAL');
  });
  it('builds monotonic Pareto accumulation without hardcoding 80/20', () => {
    const pareto = buildPareto([
      { customerId: 'a', orderCount: 10, paidAmount: 1_000_000 },
      { customerId: 'b', orderCount: 5, paidAmount: 200_000 },
      { customerId: 'c', orderCount: 1, paidAmount: 0 },
    ]);

    expect(pareto.ordersSeries.at(-1)?.cumulativePct).toBeCloseTo(100);
    expect(pareto.paidSeries.at(-1)?.cumulativePct).toBeCloseTo(100);
    expect(pareto.ordersSeries[1]!.cumulativePct).toBeGreaterThanOrEqual(
      pareto.ordersSeries[0]!.cumulativePct,
    );
    expect(pareto.paidSeries[1]!.cumulativePct).toBeGreaterThanOrEqual(
      pareto.paidSeries[0]!.cumulativePct,
    );
  });

  it('treats multiple invoices as partial payments and subtracts reversals', () => {
    const paid =
      effectiveInvoicePaid(100_000, 0, 'REGISTERED') +
      effectiveInvoicePaid(50_000, 20_000, 'PARTIALLY_REVERSED') +
      effectiveInvoicePaid(80_000, 80_000, 'REVERSED');

    expect(paid).toBe(130_000);
  });

  it('handles zero payments and very high values without scale addition', () => {
    const rows = calculateCustomerScores([
      { customerId: 'zero', orderCount: 4, paidAmount: 0 },
      { customerId: 'outlier', orderCount: 1, paidAmount: 999_999_999 },
      { customerId: 'balanced', orderCount: 3, paidAmount: 50_000 },
    ]);

    for (const row of rows) {
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(100);
    }
  });
});
