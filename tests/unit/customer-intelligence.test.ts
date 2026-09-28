import { describe, expect, it } from 'vitest';
import {
  calculateCustomerScores,
  classifyCustomer,
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
});
