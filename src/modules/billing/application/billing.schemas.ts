import { z } from 'zod';

export const billingReadinessSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  orderType: z.string(),
  routeCode: z.string(),
  currentStep: z.string(),
  billingReady: z.boolean(),
  billingRequirement: z.enum(['PVP_ANNEX', 'REGISTERED_INVOICE']),
  financialDecision: z.string(),
  financialReason: z.string(),
  blockingIssueOpen: z.boolean(),
  readyForLogistics: z.boolean(),
  contractVersion: z.string(),
});

const billingInvoiceSchema = z.object({
  id: z.string().uuid(),
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  amount: z.coerce.number(),
  reversedAmount: z.coerce.number(),
  status: z.string(),
});

export const billingQueueItemSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  customerName: z.string(),
  orderType: z.string(),
  currentStep: z.string(),
  routeCode: z.string(),
  orderVersion: z.number().int().positive().optional(),
  billingReady: z.boolean(),
  financial: z.object({
    decision: z.string(),
    reason: z.string(),
  }).passthrough(),
  invoices: z.array(billingInvoiceSchema),
  pvpAnnexCount: z.number().int().nonnegative(),
});

export const billingQueueSchema = z.object({
  items: z.array(billingQueueItemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
  contractVersion: z.string(),
});

export type BillingReadiness = z.infer<typeof billingReadinessSchema>;
export type BillingQueue = z.infer<typeof billingQueueSchema>;
export type BillingQueueItem = z.infer<typeof billingQueueItemSchema>;
