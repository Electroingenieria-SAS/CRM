import { z } from 'zod';

export const orderWorkforceEventTypeSchema = z.enum([
  'OrderTaskClaimed',
  'OrderTaskAssigned',
  'OrderTaskStarted',
  'OrderBlocked',
  'OrderTaskResumed',
  'OrderTaskCompleted',
  'OrderCancelled',
  'ReconcileOrderTask',
]);

export const orderWorkforceEventSchema = z.object({
  contractVersion: z.literal('1.0.0'),
  orderEventId: z.number().int().nonnegative().optional(),
  orderId: z.string().uuid(),
  orderTaskId: z.string().uuid().nullable(),
  stepCode: z.string().min(1),
  integrationEvent: orderWorkforceEventTypeSchema,
  workforceCatalogCode: z.string().min(1),
  activityTitle: z.string().optional(),
  actorProfileId: z.string().uuid().nullable().optional(),
  assigneeProfileId: z.string().uuid().nullable(),
  sellerProfileId: z.string().uuid(),
  occurredAt: z.string(),
  orderTaskStatus: z.string().optional(),
  reconciliation: z.boolean().optional(),
  orderPayload: z.record(z.string(), z.unknown()).optional(),
});

export const orderWorkforceOutboxItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  orderTaskId: z.string().uuid().nullable(),
  stepCode: z.string(),
  integrationEvent: orderWorkforceEventTypeSchema,
  workforceCatalogCode: z.string(),
  actorProfileId: z.string().uuid().nullable(),
  assigneeProfileId: z.string().uuid().nullable(),
  sellerProfileId: z.string().uuid(),
  dedupeKey: z.string(),
  status: z.enum(['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'SKIPPED']),
  attempts: z.number().int().nonnegative(),
  workforceActivityId: z.string().uuid().nullable(),
  payload: orderWorkforceEventSchema,
  createdAt: z.string(),
});

export const orderWorkforcePendingResponseSchema = z.object({
  items: z.array(orderWorkforceOutboxItemSchema),
  contractVersion: z.string(),
});

export const outboxClaimResponseSchema = z.object({
  success: z.literal(true),
  idempotent: z.boolean(),
  outboxId: z.string().uuid(),
  status: z.string(),
  event: orderWorkforceEventSchema.optional(),
  dedupeKey: z.string().optional(),
  workforceActivityId: z.string().uuid().nullable().optional(),
  attempts: z.number().int().nonnegative().optional(),
  contractVersion: z.string(),
});

export const workforceAutomationResultSchema = z.object({
  activityId: z.string().uuid(),
  status: z.string(),
  idempotent: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type OrderWorkforceEvent = z.infer<typeof orderWorkforceEventSchema>;
export type OrderWorkforceOutboxItem = z.infer<typeof orderWorkforceOutboxItemSchema>;
export type WorkforceAutomationResult = z.infer<typeof workforceAutomationResultSchema>;
