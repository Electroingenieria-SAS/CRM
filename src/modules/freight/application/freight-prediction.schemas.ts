import { z } from 'zod';

export const freightRouteSchema = z.enum([
  'CLIENT_POINT',
  'CLIENT_PICKUP',
  'LOCAL_DISPATCH',
  'NATIONAL_DISPATCH',
]);

export const freightPredictionInputSchema = z.object({
  destinationId: z.string().uuid(),
  routeCode: freightRouteSchema,
  carrierId: z.string().uuid().optional(),
  weightKg: z.number().nonnegative().optional(),
  packageCount: z.number().nonnegative().optional(),
  volumeM3: z.number().nonnegative().optional(),
  orderId: z.string().uuid().optional(),
});

export const freightPredictionResultSchema = z.object({
  predictionId: z.string().uuid(),
  available: z.boolean(),
  status: z.enum(['AVAILABLE', 'INSUFFICIENT', 'NOT_APPLICABLE']),
  carrierId: z.string().uuid().nullable(),
  carrierCode: z.string().nullable(),
  carrierName: z.string().nullable(),
  destinationId: z.string().uuid(),
  city: z.string().optional(),
  department: z.string().optional(),
  fallbackLevel: z.enum(['CITY', 'DEPARTMENT', 'NATIONAL', 'NONE', 'NOT_APPLICABLE']),
  evidenceLevel: z.enum(['HIGH', 'MEDIUM', 'LOW', 'NONE', 'NOT_APPLICABLE']),
  sampleCount: z.number().int().nonnegative(),
  baselineSamples: z.number().int().nonnegative().optional(),
  actualSamples: z.number().int().nonnegative().optional(),
  outlierCount: z.number().int().nonnegative(),
  estimateLow: z.number().nonnegative().optional(),
  estimateMid: z.number().nonnegative().optional(),
  estimateHigh: z.number().nonnegative().optional(),
  basis: z.string(),
  explanationCode: z.string(),
  sourceFrom: z.string().nullable().optional(),
  sourceTo: z.string().nullable().optional(),
  weightPosition: z.string().optional(),
  newObservationDistribution: z
    .object({
      mean: z.number().nullable(),
      p25: z.number().nullable(),
      p50: z.number().nullable(),
      p75: z.number().nullable(),
      p90: z.number().nullable(),
      iqr: z.number().nullable(),
    })
    .optional(),
  algorithmVersion: z.string(),
});

export const freightPredictionResponseSchema = z.object({
  results: z.array(freightPredictionResultSchema).min(1),
  algorithmVersion: z.string(),
  contractVersion: z.string(),
});

export type FreightPredictionInput = z.input<typeof freightPredictionInputSchema>;
export type FreightPredictionResult = z.infer<typeof freightPredictionResultSchema>;
export type FreightPredictionResponse = z.infer<typeof freightPredictionResponseSchema>;
