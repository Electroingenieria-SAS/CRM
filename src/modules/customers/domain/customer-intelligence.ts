export type CustomerSegment = 'PREMIUM' | 'NORMAL' | 'BASIC' | 'URGENT';

export interface CustomerIntelligenceConfig {
  readonly orderWeight: number;
  readonly paidWeight: number;
  readonly normalMinScore: number;
  readonly premiumMinScore: number;
  readonly urgentMinScore: number;
}

export interface CustomerMetricInput {
  readonly customerId: string;
  readonly orderCount: number;
  readonly paidAmount: number;
}

export interface CustomerMetricScore extends CustomerMetricInput {
  readonly frequencyPercentile: number;
  readonly paidPercentile: number;
  readonly score: number;
  readonly segment: CustomerSegment;
}

export const CUSTOMER_INTELLIGENCE_V1: CustomerIntelligenceConfig = {
  orderWeight: 0.5,
  paidWeight: 0.5,
  normalMinScore: 30,
  premiumMinScore: 70,
  urgentMinScore: 90,
};

function percentileRank(values: number[], target: number): number {
  if (values.length <= 1) return 50;

  const sorted = [...values].sort((a, b) => a - b);
  const firstIndex = sorted.findIndex((value) => value === target);
  return (firstIndex / (sorted.length - 1)) * 100;
}

export function classifyCustomer(
  score: number,
  config: CustomerIntelligenceConfig = CUSTOMER_INTELLIGENCE_V1,
): CustomerSegment {
  if (score >= config.urgentMinScore) return 'URGENT';
  if (score >= config.premiumMinScore) return 'PREMIUM';
  if (score >= config.normalMinScore) return 'NORMAL';
  return 'BASIC';
}

export function scoreCustomer(
  frequencyPercentile: number,
  paidPercentile: number,
  config: CustomerIntelligenceConfig = CUSTOMER_INTELLIGENCE_V1,
): number {
  return Number(
    (
      config.orderWeight * frequencyPercentile +
      config.paidWeight * paidPercentile
    ).toFixed(2),
  );
}

export function calculateCustomerScores(
  rows: CustomerMetricInput[],
  config: CustomerIntelligenceConfig = CUSTOMER_INTELLIGENCE_V1,
): CustomerMetricScore[] {
  const orderCounts = rows.map((row) => row.orderCount);
  const paidAmounts = rows.map((row) => row.paidAmount);

  return rows.map((row) => {
    const frequencyPercentile = percentileRank(orderCounts, row.orderCount);
    const paidPercentile = percentileRank(paidAmounts, row.paidAmount);
    const score = scoreCustomer(frequencyPercentile, paidPercentile, config);

    return {
      ...row,
      frequencyPercentile,
      paidPercentile,
      score,
      segment: classifyCustomer(score, config),
    };
  });
}

export function orderPriorityForSegment(segment: CustomerSegment) {
  switch (segment) {
    case 'URGENT':
      return 'URGENT';
    case 'PREMIUM':
      return 'HIGH';
    case 'NORMAL':
      return 'MEDIUM';
    case 'BASIC':
      return 'LOW';
  }
}
