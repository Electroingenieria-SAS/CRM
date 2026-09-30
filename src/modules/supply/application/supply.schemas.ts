import { z } from 'zod';

export const supplyAreaSchema = z.enum(['PURCHASING', 'RECEIVING', 'PICKING', 'CUTTING']);

export const supplyQueueItemSchema = z.object({
  id: z.string().uuid(),
  area: supplyAreaSchema,
  orderId: z.string().uuid().nullable(),
  orderNumber: z.string().nullable(),
  clientName: z.string().nullable(),
  status: z.string(),
  reference: z.string().nullable(),
  assignedTo: z.string().nullable(),
  updatedAt: z.string(),
});

export const supplyQueueSchema = z.object({
  items: z.array(supplyQueueItemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
  contractVersion: z.string(),
});

const supplyMaterialLineSchema = z.object({
  orderItemId: z.string().uuid(),
  materialId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).max(20),
});

export const orderReceptionInputSchema = z.object({
  orderId: z.string().uuid(),
  orderTaskId: z.string().uuid().optional(),
  pickingProfileId: z.string().uuid().optional(),
  cuttingProfileId: z.string().uuid().optional(),
  lines: z.array(
    supplyMaterialLineSchema.extend({
      locationId: z.string().uuid().optional(),
      requiresCut: z.boolean().default(false),
      cutLengthEach: z.number().positive().optional(),
      metadata: z.record(z.string(), z.unknown()).default({}),
    }),
  ).min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const purchaseRequestInputSchema = z.object({
  orderId: z.string().uuid(),
  lines: z.array(
    supplyMaterialLineSchema.extend({
      note: z.string().trim().max(500).optional(),
    }),
  ).min(1),
});

export const purchaseOrderInputSchema = z.object({
  requestId: z.string().uuid(),
  supplierId: z.string().uuid(),
  externalReference: z.string().trim().max(120).optional(),
  lines: z.array(z.object({
    requestLineId: z.string().uuid(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative().optional(),
  })).min(1),
});

export const receiptInputSchema = z.object({
  purchaseOrderId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  receiptType: z.enum(['PURCHASE', 'RETURN', 'STANDALONE']).default('PURCHASE'),
  documentReference: z.string().trim().max(160).optional(),
  lines: z.array(z.object({
    purchaseOrderLineId: z.string().uuid().optional(),
    materialId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    locationId: z.string().uuid(),
    expectedQuantity: z.number().nonnegative().optional(),
    acceptedQuantity: z.number().nonnegative(),
    rejectedQuantity: z.number().nonnegative().default(0),
    unit: z.string().trim().min(1).max(20),
    incidentCode: z.enum([
      'SHORTAGE','SURPLUS','DAMAGED','WRONG_REFERENCE','WRONG_QUANTITY','OTHER',
    ]).optional(),
    note: z.string().trim().max(1000).optional(),
  }).refine((line) => line.acceptedQuantity > 0 || line.rejectedQuantity > 0, {
    message: 'La línea debe aceptar o rechazar alguna cantidad.',
  })).min(1),
});

export const pickingJobInputSchema = z.object({
  orderId: z.string().uuid(),
  orderTaskId: z.string().uuid().optional(),
  lines: z.array(
    supplyMaterialLineSchema.extend({ locationId: z.string().uuid().optional() }),
  ).min(1),
});

export const cuttingJobInputSchema = z.object({
  orderId: z.string().uuid(),
  orderTaskId: z.string().uuid().optional(),
  lines: z.array(
    supplyMaterialLineSchema.omit({ quantity: true }).extend({
      reservationId: z.string().uuid(),
      plannedQuantity: z.number().positive(),
      cutLengthEach: z.number().positive().optional(),
    }),
  ).min(1),
});

export const supplyMutationSchema = z.object({
  success: z.literal(true),
  idempotent: z.boolean(),
  id: z.string().uuid(),
  status: z.string(),
  contractVersion: z.string(),
});

export type SupplyArea = z.infer<typeof supplyAreaSchema>;
export type SupplyQueue = z.infer<typeof supplyQueueSchema>;
export type OrderReceptionInput = z.input<typeof orderReceptionInputSchema>;
export type PurchaseRequestInput = z.input<typeof purchaseRequestInputSchema>;
export type PurchaseOrderInput = z.input<typeof purchaseOrderInputSchema>;
export type ReceiptInput = z.input<typeof receiptInputSchema>;
export type PickingJobInput = z.input<typeof pickingJobInputSchema>;
export type CuttingJobInput = z.input<typeof cuttingJobInputSchema>;
export type SupplyMutation = z.infer<typeof supplyMutationSchema>;
