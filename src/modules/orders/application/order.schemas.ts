import { z } from 'zod';

export const orderItemInputSchema = z.object({
  lineNumber: z.number().int().positive().optional(),
  sku: z.string().trim().max(120).optional(),
  reference: z.string().trim().max(160).optional(),
  description: z.string().trim().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).max(20).default('UND'),
  warehouseLocation: z.string().trim().max(120).optional(),
  requiresCut: z.boolean().default(false),
  requestedCutLength: z.number().positive().optional(),
  dimensions: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).superRefine((item, context) => {
  if (item.requiresCut && !item.requestedCutLength) {
    context.addIssue({
      code: 'custom',
      path: ['requestedCutLength'],
      message: 'La longitud de corte es obligatoria cuando el ítem requiere corte.',
    });
  }
});

export const createOrderSchema = z.object({
  orderNumber: z.string().trim().min(1).max(120),
  externalReference: z.string().trim().max(160).optional(),
  orderType: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
  paymentCondition: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()),
  deliveryRoute: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()),
  clientName: z.string().trim().min(1).max(240),
  clientDocument: z.string().trim().max(80).optional(),
  clientDepartment: z.string().trim().max(120).optional(),
  clientCity: z.string().trim().min(1).max(120),
  clientAddress: z.string().trim().min(5).max(500),
  clientPhone: z.string().trim().max(60).optional(),
  requiresPurchase: z.boolean().optional(),
  requiresCut: z.boolean().optional(),
  hasCreditArrears: z.boolean().optional(),
  heldByCashier: z.boolean().optional(),
  promisedAt: z.string().datetime({ offset: true }).optional(),
  requestedDeliveryDate: z.string().date().optional(),
  items: z.array(orderItemInputSchema).min(1).max(500),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const orderListItemSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  externalReference: z.string().nullable(),
  orderType: z.string(),
  paymentCondition: z.string(),
  route: z.string(),
  clientName: z.string(),
  currentStep: z.string(),
  stepName: z.string(),
  status: z.string(),
  priority: z.string(),
  sellerId: z.string().uuid(),
  sellerName: z.string().nullable(),
  assigneeId: z.string().uuid().nullable(),
  assigneeName: z.string().nullable(),
  isHistory: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().positive(),
});

export const orderListResponseSchema = z.object({
  items: z.array(orderListItemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
  contractVersion: z.string(),
});

export const createOrderResponseSchema = z.object({
  success: z.literal(true),
  idempotent: z.boolean(),
  orderId: z.string().uuid(),
  currentStep: z.string().optional(),
  status: z.string().optional(),
  contractVersion: z.string(),
});

export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type OrderListResponse = z.infer<typeof orderListResponseSchema>;
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;
