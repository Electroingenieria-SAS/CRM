import { z } from 'zod';

export const orderItemInputSchema = z
  .object({
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
  })
  .superRefine((item, context) => {
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
  orderType: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((value) => value.toUpperCase()),
  paymentCondition: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .transform((value) => value.toUpperCase()),
  deliveryRoute: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value) => value.toUpperCase()),
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

export const orderDetailResponseSchema = z.object({
  order: z
    .object({
      id: z.string().uuid(),
      order_number: z.string(),
      client_name: z.string(),
      client_city: z.string().nullable(),
      client_address: z.string().nullable(),
      order_type_code: z.string(),
      payment_condition_code: z.string(),
      delivery_route_code: z.string(),
      current_step_code: z.string(),
      status: z.string(),
      priority: z.string(),
      current_assignee_id: z.string().uuid().nullable(),
      current_role_code: z.string().nullable(),
      version: z.number().int().positive(),
      created_at: z.string(),
      updated_at: z.string(),
    })
    .passthrough(),
  items: z.array(
    z
      .object({
        id: z.string().uuid(),
        description: z.string(),
        quantity: z.coerce.number(),
        unit: z.string(),
        sku: z.string().nullable(),
        reference: z.string().nullable(),
        requires_cut: z.boolean(),
        requested_cut_length: z.coerce.number().nullable(),
      })
      .passthrough(),
  ),
  tasks: z.array(z.record(z.string(), z.unknown())),
  blocks: z.array(z.record(z.string(), z.unknown())),
  issues: z.array(z.record(z.string(), z.unknown())),
  evidence: z.array(z.record(z.string(), z.unknown())),
  events: z.array(z.record(z.string(), z.unknown())),
  workflow: z.object({
    actions: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        enabled: z.boolean(),
        reason: z.string().nullable().optional(),
        requires: z.array(z.string()).optional(),
      }),
    ),
    missingRequirements: z.array(z.record(z.string(), z.unknown())),
    blockingIssueOpen: z.boolean(),
    reopenCandidates: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
      }),
    ),
  }),
  assignmentCandidates: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      employeeCode: z.string().nullable(),
      roles: z.array(z.string()),
    }),
  ),
  contractVersion: z.string(),
});

export type OrderListItem = z.infer<typeof orderListItemSchema>;
export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type OrderListResponse = z.infer<typeof orderListResponseSchema>;
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;
export type OrderDetailResponse = z.infer<typeof orderDetailResponseSchema>;
