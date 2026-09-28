import { z } from 'zod';

export const freightCarrierSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
});

export const freightDestinationSchema = z.object({
  id: z.string().uuid(),
  cityKey: z.string(),
  city: z.string(),
  departmentKey: z.string(),
  department: z.string(),
  countryCode: z.string(),
});

export const freightCoverageSchema = z.object({
  historicalSamples: z.number().nonnegative(),
  aggregateRows: z.number().nonnegative(),
  cities: z.number().nonnegative(),
  departments: z.number().nonnegative(),
  carriers: z.number().nonnegative(),
  sourceFrom: z.string().nullable(),
  sourceTo: z.string().nullable(),
  newActuals: z.number().nonnegative(),
});

export const freightCatalogSchema = z.object({
  carriers: z.array(freightCarrierSchema),
  destinations: z.array(freightDestinationSchema),
  coverage: freightCoverageSchema,
  algorithmVersion: z.string(),
  contractVersion: z.string(),
});

export type FreightCarrier = z.infer<typeof freightCarrierSchema>;
export type FreightDestination = z.infer<typeof freightDestinationSchema>;
export type FreightCatalog = z.infer<typeof freightCatalogSchema>;
