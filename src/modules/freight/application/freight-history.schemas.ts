import { z } from 'zod';
import { freightRouteSchema } from '@/modules/freight/application/freight-prediction.schemas';

export const freightHistoryRowSchema = z.object({
  id: z.string().uuid(),
  carrierId: z.string().uuid(),
  carrierCode: z.string(),
  carrierName: z.string(),
  destinationId: z.string().uuid(),
  city: z.string(),
  department: z.string(),
  route: freightRouteSchema,
  sampleCount: z.number().int().positive(),
  weightSampleCount: z.number().int().nonnegative(),
  weightP20: z.number().nonnegative().nullable(),
  weightP50: z.number().nonnegative().nullable(),
  weightP80: z.number().nonnegative().nullable(),
  costP20: z.number().nonnegative(),
  costP50: z.number().nonnegative(),
  costP80: z.number().nonnegative(),
  transitSamples: z.number().int().nonnegative(),
  transitP50Days: z.number().nonnegative().nullable(),
  transitP80Days: z.number().nonnegative().nullable(),
  sourceFrom: z.string(),
  sourceTo: z.string(),
  sourceLabel: z.string(),
});

export const freightActualSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid().nullable(),
  carrierId: z.string().uuid(),
  carrierName: z.string(),
  destinationId: z.string().uuid(),
  city: z.string(),
  department: z.string(),
  route: freightRouteSchema,
  actualCost: z.number().nonnegative(),
  weightKg: z.number().nonnegative().nullable(),
  packageCount: z.number().nonnegative().nullable(),
  volumeM3: z.number().nonnegative().nullable(),
  observedAt: z.string(),
  source: z.string(),
});

export const freightHistoryResponseSchema = z.object({
  rows: z.array(freightHistoryRowSchema),
  recentActuals: z.array(freightActualSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
  contractVersion: z.string(),
});

export const freightMetricsSchema = z.object({
  summary: z.object({
    evaluatedPredictions: z.number().int().nonnegative(),
    mae: z.number().nullable(),
    mape: z.number().nullable(),
    bias: z.number().nullable(),
  }),
  byCarrier: z.array(
    z.object({
      carrierId: z.string().uuid().nullable(),
      carrierName: z.string().nullable(),
      samples: z.number().int().nonnegative(),
      mae: z.number().nullable(),
      mape: z.number().nullable(),
      bias: z.number().nullable(),
    }),
  ),
  algorithmVersion: z.string(),
  contractVersion: z.string(),
});

export const recordFreightActualInputSchema = z.object({
  carrierId: z.string().uuid(),
  destinationId: z.string().uuid(),
  routeCode: freightRouteSchema,
  actualCost: z.number().nonnegative(),
  observedAt: z.string().datetime({ offset: true }),
  orderId: z.string().uuid().optional(),
  predictionId: z.string().uuid().optional(),
  weightKg: z.number().nonnegative().optional(),
  packageCount: z.number().nonnegative().optional(),
  volumeM3: z.number().nonnegative().optional(),
  serviceType: z.string().trim().max(120).optional(),
  declaredValue: z.number().nonnegative().optional(),
  externalKey: z.string().trim().max(200).optional(),
});

export const recordFreightActualResponseSchema = z.object({
  success: z.literal(true),
  observationId: z.string().uuid(),
  predictionId: z.string().uuid().nullable(),
  absoluteError: z.number().nonnegative().nullable(),
  absolutePercentageError: z.number().nonnegative().nullable(),
  signedError: z.number().nullable(),
  contractVersion: z.string(),
});

export type FreightHistoryResponse = z.infer<typeof freightHistoryResponseSchema>;
export type FreightMetrics = z.infer<typeof freightMetricsSchema>;
export type RecordFreightActualInput = z.input<typeof recordFreightActualInputSchema>;
export type RecordFreightActualResponse = z.infer<typeof recordFreightActualResponseSchema>;
