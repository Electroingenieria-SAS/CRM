import { z } from 'zod';

export const customerSegmentSchema = z.enum(['PREMIUM', 'NORMAL', 'BASIC', 'URGENT']);
export const supportLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const customerIntelligenceRowSchema = z.object({
  customerId: z.string().uuid(),
  customerName: z.string(),
  customerDocument: z.string().nullable(),
  identityKind: z.enum(['DOCUMENT', 'PROVISIONAL_ORDER']),
  validOrderCount: z.coerce.number().int().nonnegative(),
  paidAmount: z.coerce.number().nonnegative(),
  orderRank: z.coerce.number().int().positive(),
  paidRank: z.coerce.number().int().positive(),
  overallRank: z.coerce.number().int().positive(),
  frequencyPercentile: z.coerce.number().min(0).max(100),
  paidPercentile: z.coerce.number().min(0).max(100),
  percentile: z.coerce.number().min(0).max(100),
  score: z.coerce.number().min(0).max(100),
  segment: customerSegmentSchema,
  supportLevel: supportLevelSchema,
  provisional: z.boolean(),
  orderSharePct: z.coerce.number().min(0).max(100),
  paidSharePct: z.coerce.number().min(0).max(100),
  cumulativeOrdersPct: z.coerce.number().min(0).max(100),
  cumulativePaidPct: z.coerce.number().min(0).max(100),
  firstOrderAt: z.string(),
  lastOrderAt: z.string(),
  calculatedAt: z.string(),
  algorithmVersion: z.string(),
});

export const customerIntelligenceListSchema = z.object({
  items: z.array(customerIntelligenceRowSchema),
  pagination: z.object({
    page: z.coerce.number().int().positive(),
    pageSize: z.coerce.number().int().positive(),
    totalItems: z.coerce.number().int().nonnegative(),
    totalPages: z.coerce.number().int().nonnegative(),
  }),
  state: z.object({
    dirty: z.boolean(),
    dirtySince: z.string().nullable(),
    lastCalculatedAt: z.string().nullable(),
    algorithmVersion: z.string(),
  }),
  contractVersion: z.string(),
});

export const customerIntelligenceDetailSchema = z.object({
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    document: z.string().nullable(),
    identityKind: z.enum(['DOCUMENT', 'PROVISIONAL_ORDER']),
  }),
  metrics: z.object({
    validOrderCount: z.coerce.number().int().nonnegative(),
    paidAmount: z.coerce.number().nonnegative(),
    orderRank: z.coerce.number().int().positive(),
    paidRank: z.coerce.number().int().positive(),
    overallRank: z.coerce.number().int().positive(),
    frequencyPercentile: z.coerce.number().min(0).max(100),
    paidPercentile: z.coerce.number().min(0).max(100),
    percentile: z.coerce.number().min(0).max(100),
    score: z.coerce.number().min(0).max(100),
    segment: customerSegmentSchema,
    supportLevel: supportLevelSchema,
    provisional: z.boolean(),
    firstOrderAt: z.string(),
    lastOrderAt: z.string(),
    calculatedAt: z.string(),
    algorithmVersion: z.string(),
  }),
  history: z.array(
    z.object({
      segment: customerSegmentSchema,
      previousSegment: customerSegmentSchema.nullable(),
      score: z.coerce.number(),
      validOrderCount: z.coerce.number().int(),
      paidAmount: z.coerce.number(),
      algorithmVersion: z.string(),
      changedAt: z.string(),
    }),
  ),
  explanation: z.object({
    orderWeight: z.coerce.number(),
    paidWeight: z.coerce.number(),
    normalMinScore: z.coerce.number(),
    premiumMinScore: z.coerce.number(),
    urgentMinScore: z.coerce.number(),
    paidSource: z.literal('REGISTERED_INVOICES_NET_OF_REVERSALS'),
  }),
  contractVersion: z.string(),
});

export const paretoResponseSchema = z.object({
  points: z.array(
    z.object({
      rank: z.coerce.number().int().positive(),
      customerId: z.string().uuid(),
      customerName: z.string(),
      ordersCumulativePct: z.coerce.number().min(0).max(100),
      paidCumulativePct: z.coerce.number().min(0).max(100),
    }),
  ),
  summary: z.object({
    customers: z.coerce.number().int().nonnegative().default(0),
    orders: z.coerce.number().int().nonnegative().default(0),
    paidAmount: z.coerce.number().nonnegative().default(0),
    top20CustomersPaidPct: z.coerce.number().min(0).max(100).default(0),
    top20CustomersOrdersPct: z.coerce.number().min(0).max(100).default(0),
  }),
  contractVersion: z.string(),
});

export const recalculateResponseSchema = z.object({
  success: z.literal(true),
  reused: z.boolean(),
  runId: z.string().uuid(),
  algorithmVersion: z.string(),
  customerCount: z.coerce.number().int().nonnegative(),
  validOrderCount: z.coerce.number().int().nonnegative(),
  totalPaid: z.coerce.number().nonnegative(),
});

export const prioritySignalSchema = z.object({
  customerId: z.string().uuid().optional(),
  segment: customerSegmentSchema,
  orderPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  score: z.coerce.number().min(0).max(100),
  overallRank: z.coerce.number().int().positive().optional(),
  provisional: z.boolean(),
  supportLevel: supportLevelSchema,
  reason: z.string().optional(),
  algorithmVersion: z.string(),
});

export type CustomerIntelligenceRow = z.infer<typeof customerIntelligenceRowSchema>;
export type CustomerIntelligenceList = z.infer<typeof customerIntelligenceListSchema>;
export type CustomerIntelligenceDetail = z.infer<typeof customerIntelligenceDetailSchema>;
export type ParetoResponse = z.infer<typeof paretoResponseSchema>;
export type RecalculateResponse = z.infer<typeof recalculateResponseSchema>;
export type PrioritySignal = z.infer<typeof prioritySignalSchema>;
