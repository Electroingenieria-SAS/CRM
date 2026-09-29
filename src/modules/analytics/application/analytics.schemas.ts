import { z } from 'zod';

const rangeSchema = z.object({
  from: z.string(),
  to: z.string(),
  timezone: z.string(),
});

const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const analyticsDashboardSchema = z.object({
  range: rangeSchema,
  summary: z.object({
    ordersTotal: z.number().int().nonnegative(),
    ordersActive: z.number().int().nonnegative(),
    ordersClosed: z.number().int().nonnegative(),
    ordersBlocked: z.number().int().nonnegative(),
    financialPending: z.number().int().nonnegative(),
    deliveriesPending: z.number().int().nonnegative(),
  }),
  ordersByStep: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      count: z.number().int().nonnegative(),
      blocked: z.number().int().nonnegative(),
      overdue: z.number().int().nonnegative(),
      slaHours: z.coerce.number().nullable(),
    }),
  ),
  alerts: z.array(
    z.object({
      orderId: z.string().uuid(),
      orderNumber: z.string(),
      clientName: z.string(),
      stepCode: z.string(),
      stepName: z.string(),
      status: z.string(),
      alertType: z.string(),
      severity: z.enum(['warning', 'critical']),
      ageMinutes: z.coerce.number().nonnegative(),
      updatedAt: z.string(),
    }),
  ),
  workforce: z.record(z.string(), z.unknown()).nullable(),
  customerIntelligence: z.record(z.string(), z.unknown()).nullable(),
  freight: z.record(z.string(), z.unknown()).nullable(),
  inventory: z.record(z.string(), z.unknown()).nullable(),
  logistics: z.record(z.string(), z.unknown()).nullable(),
  sources: z.object({
    orders: z.boolean(),
    workforce: z.boolean(),
    customerIntelligence: z.boolean(),
    freight: z.boolean(),
    inventory: z.boolean(),
    logistics: z.boolean(),
  }),
  contractVersion: z.string(),
});

export const kpiCatalogSchema = z.array(
  z.object({
    code: z.string(),
    name: z.string(),
    definition: z.string(),
    formula: z.string(),
    source: z.string(),
    temporalScope: z.string(),
    filters: z.array(z.string()),
    limitations: z.string().nullable(),
  }),
);

const vsmStageSchema = z.object({
  stepCode: z.string(),
  stepName: z.string(),
  samples: z.number().int().nonnegative().optional(),
  averageWaitingMinutes: z.coerce.number().nonnegative().optional(),
  averageProcessingMinutes: z.coerce.number().nonnegative().optional(),
  averageBlockedMinutes: z.coerce.number().nonnegative().optional(),
  averageTotalMinutes: z.coerce.number().nonnegative().optional(),
  medianMinutes: z.coerce.number().nonnegative().optional(),
  p75Minutes: z.coerce.number().nonnegative().optional(),
  p90Minutes: z.coerce.number().nonnegative().optional(),
  p95Minutes: z.coerce.number().nonnegative().optional(),
  currentQueue: z.number().int().nonnegative().optional(),
});

export const analyticsVsmSummarySchema = z.object({
  range: rangeSchema,
  overall: z.object({
    orders: z.number().int().nonnegative(),
    averageStageCycleMinutes: z.coerce.number().nonnegative(),
    medianStageCycleMinutes: z.coerce.number().nonnegative(),
    p90StageCycleMinutes: z.coerce.number().nonnegative(),
    averageWaitingMinutes: z.coerce.number().nonnegative(),
    averageProcessingMinutes: z.coerce.number().nonnegative(),
    averageBlockedMinutes: z.coerce.number().nonnegative(),
    averageTransitMinutes: z.coerce.number().nonnegative(),
  }),
  stages: z.array(vsmStageSchema),
  bottlenecks: z.array(
    z.object({
      stepCode: z.string(),
      stepName: z.string(),
      evidence: z.object({
        averageWaitingMinutes: z.coerce.number().nonnegative(),
        averageTotalMinutes: z.coerce.number().nonnegative(),
        p90Minutes: z.coerce.number().nonnegative(),
        samples: z.number().int().nonnegative(),
        currentQueue: z.number().int().nonnegative(),
        blockedOrders: z.number().int().nonnegative(),
      }),
    }),
  ),
  definitions: z.record(z.string(), z.string()),
  contractVersion: z.string(),
});

export const analyticsOrderVsmSchema = z.object({
  source: z.enum(['OPERATIONAL', 'HISTORICAL']),
  orderId: z.string().uuid().nullable(),
  externalOrderKey: z.string().nullable(),
  orderNumber: z.string(),
  clientName: z.string().nullable(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
  leadTimeMinutes: z.coerce.number().nonnegative(),
  stages: z.array(
    z.object({
      stepCode: z.string(),
      stepName: z.string(),
      status: z.string(),
      createdAt: z.string(),
      startedAt: z.string().nullable(),
      completedAt: z.string().nullable(),
      waitingMinutes: z.coerce.number().nonnegative(),
      processingMinutes: z.coerce.number().nonnegative(),
      blockedMinutes: z.coerce.number().nonnegative(),
      transitMinutes: z.coerce.number().nonnegative().nullable(),
      totalMinutes: z.coerce.number().nonnegative(),
    }),
  ),
  logistics: z.record(z.string(), z.unknown()).nullable(),
  contractVersion: z.string(),
});

export const reportCatalogSchema = z.object({
  items: z.array(z.object({ code: z.string(), name: z.string() })),
  contractVersion: z.string(),
});

export const reportResponseSchema = z.object({
  report: z.string(),
  columns: z.array(z.object({ key: z.string(), label: z.string() })),
  rows: z.array(z.record(z.string(), z.unknown())),
  pagination: paginationSchema,
  range: rangeSchema,
  contractVersion: z.string(),
});

const importErrorSchema = z.object({
  rowNumber: z.number().int().positive(),
  status: z.string().optional(),
  errors: z.array(z.record(z.string(), z.unknown())),
});

export const importPreviewSchema = z.object({
  batchId: z.string().uuid(),
  idempotent: z.boolean(),
  status: z.string(),
  policy: z.string().optional(),
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative().optional(),
  rejectedRows: z.number().int().nonnegative(),
  appliedRows: z.number().int().nonnegative().optional(),
  preview: z.array(z.record(z.string(), z.unknown())).optional(),
  errors: z.array(importErrorSchema),
  contractVersion: z.string(),
});

export const importApplySchema = z.object({
  batchId: z.string().uuid(),
  idempotent: z.boolean(),
  status: z.string(),
  totalRows: z.number().int().nonnegative().optional(),
  appliedRows: z.number().int().nonnegative(),
  rejectedRows: z.number().int().nonnegative(),
  errors: z.array(importErrorSchema).optional(),
  contractVersion: z.string(),
});

export const importListSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
  pagination: paginationSchema,
  contractVersion: z.string(),
});

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  client?: string;
  sellerId?: string;
  responsibleId?: string;
  step?: string;
  status?: string;
  route?: string;
  segment?: string;
  source?: string;
}

export interface HistoricalImportInput {
  importType: 'ORDER_STAGE_HISTORY_V1';
  fileName: string;
  checksumSha256: string;
  fileSizeBytes: number;
  source: string;
  rows: Array<Record<string, string>>;
}

export type AnalyticsDashboard = z.infer<typeof analyticsDashboardSchema>;
export type KpiCatalog = z.infer<typeof kpiCatalogSchema>;
export type AnalyticsVsmSummary = z.infer<typeof analyticsVsmSummarySchema>;
export type AnalyticsOrderVsm = z.infer<typeof analyticsOrderVsmSchema>;
export type ReportCatalog = z.infer<typeof reportCatalogSchema>;
export type ReportResponse = z.infer<typeof reportResponseSchema>;
export type ImportPreview = z.infer<typeof importPreviewSchema>;
export type ImportApply = z.infer<typeof importApplySchema>;
export type ImportList = z.infer<typeof importListSchema>;
