import { z } from 'zod';

export const financialDecisionSchema = z.enum([
  'APPROVED',
  'REJECTED',
  'ON_HOLD',
  'REQUIRES_REVIEW',
  'RELEASED',
]);

export const creditRequestInputSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    orderId: z.string().uuid().optional(),
    requestNumber: z.string().trim().max(120).optional(),
    requestedAmount: z.number().positive(),
    requestedTermDays: z.number().int().positive(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((value, context) => {
    if (!value.customerId && !value.orderId) {
      context.addIssue({
        code: 'custom',
        path: ['customerId'],
        message: 'Debes indicar cliente o pedido.',
      });
    }
  });

export const financeCustomerSearchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      document: z.string().nullable(),
    }),
  ),
  contractVersion: z.string(),
});

export const creditQueueItemSchema = z.object({
  id: z.string().uuid(),
  requestNumber: z.string(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  customerDocument: z.string().nullable(),
  orderId: z.string().uuid().nullable(),
  requestedAmount: z.coerce.number(),
  requestedTermDays: z.number().int().positive(),
  status: z.string(),
  requestedBy: z.string(),
  assignedTo: z.string().nullable(),
  decisionReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const creditQueueSchema = z.object({
  items: z.array(creditQueueItemSchema),
  pagination: paginationSchema,
  contractVersion: z.string(),
});

export const financeQueueItemSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  customerId: z.string().uuid().nullable(),
  customerName: z.string(),
  customerDocument: z.string().nullable(),
  orderType: z.string(),
  paymentCondition: z.string(),
  currentStep: z.string(),
  orderStatus: z.string(),
  paidAmount: z.coerce.number(),
  activeHold: z
    .object({
      id: z.string().uuid(),
      reasonCode: z.string(),
      reason: z.string(),
      createdAt: z.string(),
      metadata: z.record(z.string(), z.unknown()),
    })
    .nullable(),
  latestValidation: z
    .object({
      id: z.string().uuid(),
      result: financialDecisionSchema,
      reason: z.string(),
      reference: z.string().nullable(),
      createdAt: z.string(),
    })
    .nullable(),
  invoiceCount: z.coerce.number().int().nonnegative(),
});

export const financeQueueSchema = z.object({
  items: z.array(financeQueueItemSchema),
  pagination: paginationSchema,
  contractVersion: z.string(),
});

const invoiceSchema = z.object({
  id: z.string().uuid(),
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  amount: z.coerce.number(),
  reversedAmount: z.coerce.number(),
  paidAmount: z.coerce.number(),
  currency: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

const holdSchema = z.object({
  id: z.string().uuid(),
  domain: z.string(),
  reasonCode: z.string(),
  reason: z.string(),
  createdAt: z.string(),
  metadata: z.record(z.string(), z.unknown()),
});

export const orderFinancialSummarySchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  paymentCondition: z.string(),
  paidAmount: z.coerce.number(),
  paymentTruth: z.literal('REGISTERED_INVOICES_NET_OF_REVERSALS'),
  credit: z
    .object({
      requestId: z.string().uuid(),
      requestNumber: z.string(),
      requestedAmount: z.coerce.number(),
      requestedTermDays: z.number().int().positive(),
      status: z.string(),
      balanceAgainstRequestedAmount: z.coerce.number(),
    })
    .nullable(),
  availableCredit: z.null(),
  availableCreditReason: z.literal('NO_AUDITED_REUSABLE_CREDIT_LIMIT'),
  activeHolds: z.array(holdSchema),
  validations: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.string(),
      result: financialDecisionSchema,
      reason: z.string(),
      reference: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  invoices: z.array(invoiceSchema),
  supports: z.array(
    z.object({
      id: z.string().uuid(),
      invoiceId: z.string().uuid().nullable(),
      supportType: z.string(),
      storageProvider: z.string(),
      storageReference: z.string(),
      validationStatus: z.string(),
      createdAt: z.string(),
    }),
  ),
  contractVersion: z.string(),
});

export const financialApprovalQueueSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      orderId: z.string().uuid(),
      orderNumber: z.string(),
      customerName: z.string(),
      holdId: z.string().uuid().nullable(),
      requestType: z.string(),
      status: z.string(),
      reason: z.string(),
      requestedById: z.string().uuid(),
      requestedBy: z.string(),
      decidedBy: z.string().nullable(),
      decisionReason: z.string().nullable(),
      createdAt: z.string(),
      decidedAt: z.string().nullable(),
    }),
  ),
  pagination: paginationSchema,
  contractVersion: z.string(),
});

export const financialGateSchema = z.object({
  decision: financialDecisionSchema,
  domain: z.string().nullable(),
  reason: z.string(),
  holdId: z.string().uuid().optional(),
  validationId: z.string().uuid().optional(),
  nextActorModule: z.string().nullable(),
  contractVersion: z.string(),
});

export const customerPaidProjectionSchema = z.object({
  customerId: z.string().uuid(),
  totalPaid: z.coerce.number().nonnegative(),
  invoiceCount: z.coerce.number().int().nonnegative(),
  source: z.literal('REGISTERED_INVOICES_NET_OF_REVERSALS'),
  contractVersion: z.string(),
});

export type CreditRequestInput = z.input<typeof creditRequestInputSchema>;
export type FinanceCustomerSearch = z.infer<typeof financeCustomerSearchSchema>;
export type CreditQueue = z.infer<typeof creditQueueSchema>;
export type FinanceQueue = z.infer<typeof financeQueueSchema>;
export type FinanceQueueItem = z.infer<typeof financeQueueItemSchema>;
export type OrderFinancialSummary = z.infer<typeof orderFinancialSummarySchema>;
export type FinancialApprovalQueue = z.infer<typeof financialApprovalQueueSchema>;
export type FinancialGate = z.infer<typeof financialGateSchema>;
export type CustomerPaidProjection = z.infer<typeof customerPaidProjectionSchema>;
