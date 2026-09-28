import { z } from 'zod';

const activityStatusSchema = z.enum([
  'PLANNED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
]);

const occupancySchema = z.enum([
  'AVAILABLE',
  'OCCUPIED',
  'BLOCKED',
  'OUT_OF_SCHEDULE',
]);

const timeSignalSchema = z.enum(['NORMAL', 'OVER_60_MINUTES']);

export const workforceCatalogItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  categoryCode: z.string(),
  categoryLabel: z.string(),
  subcategory: z.string(),
  activityGroup: z.string(),
  activityKind: z.enum(['ACTIVITY', 'DELIVERABLE']),
  standardMinutes: z.number().int().positive().nullable(),
  evidencePolicy: z.enum([
    'NONE',
    'FINAL_PHOTO',
    'BEFORE_AFTER',
    'FILE',
    'LINK',
    'ERP_REFERENCE',
  ]),
  teamAllowed: z.boolean(),
  allowedRoles: z.array(z.string()),
  sortOrder: z.number().int(),
});

export const workforceCatalogResponseSchema = z.object({
  items: z.array(workforceCatalogItemSchema),
  contractVersion: z.string(),
});

export const workforcePersonSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  employeeCode: z.string().nullable(),
  roles: z.array(z.string()),
  occupancy: occupancySchema,
  specialTreatment: z.boolean(),
  specialTreatmentLabel: z.string().nullable(),
  excludeFromOccupancyMetrics: z.boolean(),
  excludeFromTimeMetrics: z.boolean(),
});

export const workforceActivitySummarySchema = z.object({
  id: z.string().uuid(),
  assigneeProfileId: z.string().uuid(),
  assigneeName: z.string(),
  catalogId: z.string().uuid(),
  catalogCode: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  categoryCode: z.string(),
  categoryLabel: z.string(),
  subcategory: z.string(),
  activityKind: z.string(),
  evidencePolicy: z.string(),
  status: activityStatusSchema,
  source: z.string(),
  plannedStart: z.string(),
  plannedEnd: z.string(),
  actualStart: z.string().nullable(),
  actualEnd: z.string().nullable(),
  orderId: z.string().uuid().nullable(),
  orderTaskId: z.string().uuid().nullable(),
  orderNumber: z.string().nullable(),
  blockReason: z.string().nullable(),
  timeSignal: timeSignalSchema,
  businessSeconds: z.number().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  version: z.number().int().positive(),
});

export const workforceScheduleResponseSchema = z.object({
  range: z.object({
    from: z.string(),
    to: z.string(),
    timezone: z.string(),
  }),
  people: z.array(workforcePersonSchema),
  activities: z.array(workforceActivitySummarySchema),
  calendar: z.object({
    segments: z.array(
      z.object({
        weekday: z.number().int().min(1).max(7),
        startTime: z.string(),
        endTime: z.string(),
      }),
    ),
    holidays: z.array(
      z.object({
        date: z.string(),
        name: z.string(),
        sourceKind: z.string(),
      }),
    ),
  }),
  contractVersion: z.string(),
});

export const createWorkforceActivitySchema = z.object({
  catalogId: z.string().uuid(),
  assigneeProfileId: z.string().uuid().optional(),
  autoAssign: z.boolean().optional(),
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(2000).optional(),
  plannedStart: z.string().datetime({ offset: true }),
  plannedEnd: z.string().datetime({ offset: true }),
  orderId: z.string().uuid().optional(),
  orderTaskId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).superRefine((value, context) => {
  if (value.assigneeProfileId && value.autoAssign) {
    context.addIssue({
      code: 'custom',
      path: ['autoAssign'],
      message: 'Elige un responsable o autoasignación, no ambos.',
    });
  }
  if (new Date(value.plannedEnd) <= new Date(value.plannedStart)) {
    context.addIssue({
      code: 'custom',
      path: ['plannedEnd'],
      message: 'La hora final debe ser posterior a la inicial.',
    });
  }
});

export const workforceMutationResponseSchema = z.object({
  success: z.literal(true),
  idempotent: z.boolean(),
  activityId: z.string().uuid(),
  status: z.string().optional(),
  version: z.number().int().positive().optional(),
  assigneeProfileId: z.string().uuid().optional(),
  evidenceId: z.string().uuid().optional(),
  evidenceType: z.string().optional(),
  contractVersion: z.string(),
}).passthrough();

export const workforceEvidenceInputSchema = z.object({
  evidenceType: z.enum([
    'BEFORE_PHOTO',
    'AFTER_PHOTO',
    'FINAL_PHOTO',
    'FILE',
    'LINK',
    'ERP_REFERENCE',
  ]),
  storageProvider: z.string().trim().min(1),
  storageReference: z.string().trim().min(1),
  fileName: z.string().trim().max(255).optional(),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().int().positive().max(15728640).optional(),
  capturedAt: z.string().datetime({ offset: true }).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const workforceActivityDetailResponseSchema = z.object({
  activity: z.object({
    id: z.string().uuid(),
    assigneeProfileId: z.string().uuid(),
    assigneeName: z.string(),
    catalogId: z.string().uuid(),
    catalogCode: z.string(),
    catalogName: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    categoryCode: z.string(),
    categoryLabel: z.string(),
    subcategory: z.string(),
    activityKind: z.string(),
    standardMinutes: z.number().int().positive().nullable(),
    evidencePolicy: z.string(),
    status: activityStatusSchema,
    source: z.string(),
    plannedStart: z.string(),
    plannedEnd: z.string(),
    actualStart: z.string().nullable(),
    actualEnd: z.string().nullable(),
    orderId: z.string().uuid().nullable(),
    orderTaskId: z.string().uuid().nullable(),
    orderNumber: z.string().nullable(),
    blockReason: z.string().nullable(),
    resultNote: z.string().nullable(),
    timeSignal: timeSignalSchema,
    evidenceComplete: z.boolean(),
    version: z.number().int().positive(),
  }),
  evidence: z.array(z.object({
    id: z.string().uuid(),
    evidenceType: z.string(),
    storageProvider: z.string(),
    storageReference: z.string(),
    fileName: z.string().nullable(),
    mimeType: z.string().nullable(),
    sizeBytes: z.number().nullable(),
    capturedAt: z.string().nullable(),
    createdAt: z.string(),
  })),
  events: z.array(z.object({
    id: z.number(),
    eventType: z.string(),
    fromStatus: z.string().nullable(),
    toStatus: z.string().nullable(),
    actorProfileId: z.string().uuid(),
    payload: z.record(z.string(), z.unknown()),
    createdAt: z.string(),
  })),
  contractVersion: z.string(),
});

export const workforceIndicatorsResponseSchema = z.object({
  summary: z.object({
    planned: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    over60Minutes: z.number().int().nonnegative(),
  }),
  people: z.array(z.object({
    profileId: z.string().uuid(),
    name: z.string(),
    occupancy: occupancySchema,
    completed: z.number().int().nonnegative(),
    activeBusinessMinutes: z.number().nonnegative(),
    over60Minutes: z.number().int().nonnegative(),
  })),
  contractVersion: z.string(),
});

export type CreateWorkforceActivityInput = z.input<typeof createWorkforceActivitySchema>;
export type WorkforceCatalogResponse = z.infer<typeof workforceCatalogResponseSchema>;
export type WorkforceScheduleResponse = z.infer<typeof workforceScheduleResponseSchema>;
export type WorkforceActivityDetailResponse = z.infer<typeof workforceActivityDetailResponseSchema>;
export type WorkforceMutationResponse = z.infer<typeof workforceMutationResponseSchema>;
export type WorkforceIndicatorsResponse = z.infer<typeof workforceIndicatorsResponseSchema>;
export type WorkforceEvidenceInput = z.input<typeof workforceEvidenceInputSchema>;

export type WorkforceCatalogItem = z.infer<typeof workforceCatalogItemSchema>;
export type WorkforcePerson = z.infer<typeof workforcePersonSchema>;
export type WorkforceActivitySummary = z.infer<typeof workforceActivitySummarySchema>;
