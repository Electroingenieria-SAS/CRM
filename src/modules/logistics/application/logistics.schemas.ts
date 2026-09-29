import { z } from 'zod';

export const logisticsRouteSchema = z.enum([
  'CLIENT_POINT',
  'CLIENT_PICKUP',
  'LOCAL_DISPATCH',
  'NATIONAL_DISPATCH',
]);

export const logisticsStatusSchema = z.enum([
  'READY',
  'IN_TRANSIT',
  'DELIVERED',
  'DELIVERY_FAILED',
  'RETURNED',
  'CANCELLED',
]);

export const logisticsMutationSchema = z.object({
  success: z.literal(true),
  idempotent: z.boolean().optional().default(false),
  shipmentId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  status: logisticsStatusSchema.optional(),
  version: z.number().int().positive().optional(),
  actualFreight: z.coerce.number().nonnegative().nullable().optional(),
  carrierId: z.string().uuid().nullable().optional(),
  destinationId: z.string().uuid().nullable().optional(),
  predictionId: z.string().uuid().nullable().optional(),
  routeCode: logisticsRouteSchema.optional(),
  dispatchedAt: z.string().optional(),
  deliveredAt: z.string().optional(),
  attemptNo: z.number().int().positive().optional(),
  trackingNumber: z.string().nullable().optional(),
  contractVersion: z.string(),
});

export const logisticsQueueItemSchema = z.object({
  shipmentId: z.string().uuid(),
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  customerName: z.string(),
  destination: z.object({
    city: z.string().nullable(),
    address: z.string().nullable(),
  }),
  routeCode: logisticsRouteSchema,
  status: logisticsStatusSchema,
  carrier: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
  }).nullable(),
  trackingNumber: z.string().nullable(),
  estimatedFreight: z.coerce.number().nonnegative().nullable(),
  actualFreight: z.coerce.number().nonnegative().nullable(),
  freightError: z.coerce.number().nullable(),
  freightSyncStatus: z.string(),
  releasedAt: z.string(),
  dispatchedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  receivedBy: z.string().nullable(),
  version: z.number().int().positive(),
});

export const logisticsQueueSchema = z.object({
  items: z.array(logisticsQueueItemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
  contractVersion: z.string(),
});

export const logisticsDetailSchema = z.object({
  order: z.object({
    id: z.string().uuid(),
    orderNumber: z.string(),
    customerName: z.string(),
    customerDocument: z.string().nullable(),
    city: z.string().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    routeCode: logisticsRouteSchema,
    currentStep: z.string(),
    status: z.string(),
    version: z.number().int().positive(),
  }),
  billing: z.record(z.string(), z.unknown()),
  shipment: z.object({
    id: z.string().uuid(),
    routeCode: logisticsRouteSchema,
    status: logisticsStatusSchema,
    carrierId: z.string().uuid().nullable(),
    carrierName: z.string().nullable(),
    destinationId: z.string().uuid().nullable(),
    predictionId: z.string().uuid().nullable(),
    trackingNumber: z.string().nullable(),
    estimatedFreight: z.coerce.number().nonnegative().nullable(),
    estimatedFreightLow: z.coerce.number().nonnegative().nullable(),
    estimatedFreightHigh: z.coerce.number().nonnegative().nullable(),
    actualFreight: z.coerce.number().nonnegative().nullable(),
    freightError: z.coerce.number().nullable(),
    freightSyncStatus: z.string(),
    releasedAt: z.string(),
    dispatchedAt: z.string().nullable(),
    deliveredAt: z.string().nullable(),
    receivedBy: z.string().nullable(),
    returnReason: z.string().nullable(),
    version: z.number().int().positive(),
  }).nullable(),
  events: z.array(z.record(z.string(), z.unknown())),
  attempts: z.array(z.record(z.string(), z.unknown())),
  satisfaction: z.record(z.string(), z.unknown()).nullable(),
  invoices: z.array(z.record(z.string(), z.unknown())),
  evidence: z.array(z.record(z.string(), z.unknown())),
  contractVersion: z.string(),
});

export type LogisticsMutation = z.infer<typeof logisticsMutationSchema>;
export type LogisticsQueue = z.infer<typeof logisticsQueueSchema>;
export type LogisticsQueueItem = z.infer<typeof logisticsQueueItemSchema>;
export type LogisticsDetail = z.infer<typeof logisticsDetailSchema>;
export type LogisticsRoute = z.infer<typeof logisticsRouteSchema>;

export const logisticsCandidateSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  customerName: z.string(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  routeCode: logisticsRouteSchema,
  orderVersion: z.number().int().positive(),
  readiness: z.object({
    readyForLogistics: z.boolean(),
    billingReady: z.boolean(),
    financialDecision: z.string(),
    blockingIssueOpen: z.boolean(),
  }).passthrough(),
});

export const logisticsCandidatesSchema = z.object({
  items: z.array(logisticsCandidateSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
  contractVersion: z.string(),
});

export type LogisticsCandidates = z.infer<typeof logisticsCandidatesSchema>;
export type LogisticsCandidate = z.infer<typeof logisticsCandidateSchema>;
