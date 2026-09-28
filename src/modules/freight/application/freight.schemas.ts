import { z } from 'zod';

export const freightRouteSchema = z.enum(['LOCAL_DISPATCH', 'NATIONAL_DISPATCH']);

export const freightPredictionInputSchema = z.object({
  route: freightRouteSchema,
  department: z.string().trim().max(120).default(''),
  city: z.string().trim().min(1).max(120),
  carrierCode: z.string().trim().max(40).optional(),
  weightKg: z.number().nonnegative().optional(),
  packageCount: z.number().nonnegative().optional(),
  volumeM3: z.number().nonnegative().optional(),
  orderId: z.string().uuid().optional(),
});

export const freightPredictionSchema = z.object({
  available: z.boolean(),
  idempotent: z.boolean().optional(),
  reason: z.string().optional(),
  predictionId: z.string().uuid().optional(),
  route: z.string().optional(),
  carrierRequested: z.string().nullable().optional(),
  carrierUsed: z.string().nullable().optional(),
  estimateMid: z.number().nullable().optional(),
  estimateLow: z.number().nullable().optional(),
  estimateHigh: z.number().nullable().optional(),
  p90: z.number().nullable().optional(),
  sampleCount: z.number().int().nonnegative().optional(),
  evidenceLevel: z.enum(['HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
  fallbackScope: z.string().optional(),
  sourcePeriod: z.object({
    from: z.string().nullable().optional(),
    to: z.string().nullable().optional(),
  }).optional(),
  outliersExcluded: z.number().int().nonnegative().optional(),
  weightContext: z.string().optional(),
  algorithmVersion: z.string(),
  calculatedAt: z.string().optional(),
  explanation: z.record(z.string(), z.unknown()).optional(),
});

export const freightCarrierSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
});

export const freightDestinationSchema = z.object({
  id: z.string().uuid(),
  city: z.string(),
  cityKey: z.string(),
  department: z.string(),
  departmentKey: z.string(),
  countryCode: z.string(),
});

export const freightCatalogsSchema = z.object({
  carriers: z.array(freightCarrierSchema),
  destinations: z.array(freightDestinationSchema),
  routes: z.array(z.string()),
  model: z.object({
    code: z.string(),
    algorithmVersion: z.string(),
    parameters: z.record(z.string(), z.unknown()),
    sourceSummary: z.record(z.string(), z.unknown()),
  }).nullable(),
});

export const freightHistoryItemSchema = z.object({
  recordType: z.enum(['LEGACY_SUMMARY', 'ACTUAL_OBSERVATION']),
  id: z.string().uuid(),
  carrierCode: z.string().nullable(),
  carrierName: z.string().nullable(),
  city: z.string(),
  department: z.string(),
  route: z.string(),
  sampleCount: z.number().int().positive(),
  estimateLow: z.number().nullable(),
  estimateMid: z.number().nullable(),
  estimateHigh: z.number().nullable(),
  actualCost: z.number().nullable(),
  weightKg: z.number().nullable(),
  observedFrom: z.string(),
  observedTo: z.string(),
  source: z.string(),
});

export const freightHistorySchema = z.object({
  items: z.array(freightHistoryItemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export const freightStatisticsSchema = z.object({
  evaluatedPredictions: z.number().int().nonnegative(),
  mae: z.number().nullable(),
  mapePct: z.number().nullable(),
  bias: z.number().nullable(),
  byFallback: z.array(z.object({
    scope: z.string(),
    count: z.number().int().nonnegative(),
    mae: z.number().nullable(),
    mapePct: z.number().nullable(),
  })),
});

export type FreightPredictionInput = z.infer<typeof freightPredictionInputSchema>;
export type FreightPrediction = z.infer<typeof freightPredictionSchema>;
export type FreightCatalogs = z.infer<typeof freightCatalogsSchema>;
export type FreightHistoryItem = z.infer<typeof freightHistoryItemSchema>;
export type FreightHistory = z.infer<typeof freightHistorySchema>;
export type FreightStatistics = z.infer<typeof freightStatisticsSchema>;
