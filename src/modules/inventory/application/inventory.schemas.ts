import { z } from 'zod';

export const inventoryPaginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const inventoryBalanceSchema = z.object({
  balanceId: z.string().uuid(),
  onHand: z.coerce.number().nonnegative(),
  reserved: z.coerce.number().nonnegative(),
  committed: z.coerce.number().nonnegative(),
  available: z.coerce.number().nonnegative(),
  version: z.number().int().positive(),
});

export const inventoryListItemSchema = inventoryBalanceSchema.extend({
  materialId: z.string().uuid(),
  reference: z.string(),
  name: z.string(),
  unit: z.string(),
  variantId: z.string().uuid().nullable(),
  variantCode: z.string().nullable(),
  variantLabel: z.string().nullable(),
  locationId: z.string().uuid(),
  locationCode: z.string(),
  locationName: z.string(),
});

export const inventoryListSchema = z.object({
  items: z.array(inventoryListItemSchema),
  pagination: inventoryPaginationSchema,
  contractVersion: z.string(),
});

export const inventoryLocationSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: z.enum(['WAREHOUSE', 'ZONE', 'SHELF', 'AREA']),
  parentId: z.string().uuid().nullable(),
});

const inventoryMaterialSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  name: z.string(),
  unit: z.string(),
  attributes: z.record(z.string(), z.unknown()),
  variant: z
    .object({
      id: z.string().uuid(),
      code: z.string(),
      label: z.string(),
      attributes: z.record(z.string(), z.unknown()),
    })
    .nullable(),
});

const inventoryReservationSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  quantity: z.coerce.number().positive(),
  unit: z.string(),
  status: z.string(),
  reference: z.string().nullable(),
  createdAt: z.string(),
});

const inventoryMovementSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  quantity: z.coerce.number().positive(),
  unit: z.string(),
  onHandDelta: z.coerce.number(),
  reservedDelta: z.coerce.number(),
  committedDelta: z.coerce.number(),
  locationCode: z.string(),
  locationName: z.string(),
  orderNumber: z.string().nullable(),
  actor: z.string(),
  reference: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: z.string(),
});

export const inventoryMaterialDetailSchema = z.object({
  material: inventoryMaterialSchema,
  balances: z.array(
    inventoryBalanceSchema.extend({
      locationId: z.string().uuid(),
      locationCode: z.string(),
      locationName: z.string(),
    }),
  ),
  reservations: z.array(inventoryReservationSchema),
  movements: z.array(inventoryMovementSchema),
  movementPagination: inventoryPaginationSchema,
  contractVersion: z.string(),
});

export const inventoryOrderTraceSchema = z.object({
  orderId: z.string().uuid(),
  reservations: z.array(
    z.object({
      id: z.string().uuid(),
      materialId: z.string().uuid(),
      reference: z.string(),
      name: z.string(),
      variantId: z.string().uuid().nullable(),
      variantLabel: z.string().nullable(),
      quantity: z.coerce.number().positive(),
      unit: z.string(),
      status: z.string(),
      createdAt: z.string(),
    }),
  ),
  movements: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.string(),
      reference: z.string(),
      name: z.string(),
      variantLabel: z.string().nullable(),
      locationCode: z.string(),
      quantity: z.coerce.number().positive(),
      unit: z.string(),
      referenceText: z.string().nullable(),
      reason: z.string().nullable(),
      actor: z.string(),
      createdAt: z.string(),
    }),
  ),
  pagination: inventoryPaginationSchema,
  contractVersion: z.string(),
});

export const inventoryReceiptResultSchema = z.object({
  movementId: z.string().uuid(),
  balance: inventoryBalanceSchema,
  contractVersion: z.string(),
});

export const inventoryReservationResultSchema = z.object({
  reservationId: z.string().uuid(),
  reserved: z.coerce.number().positive().optional(),
  quantity: z.coerce.number().positive().optional(),
  status: z.string(),
  contractVersion: z.string(),
});

export const inventoryAdjustmentResultSchema = z.object({
  movementId: z.string().uuid(),
  balance: inventoryBalanceSchema.optional(),
  reversalOf: z.string().uuid().optional(),
  contractVersion: z.string(),
});

export const inventoryCountResultSchema = z.object({
  countId: z.string().uuid(),
  status: z.string(),
  blind: z.boolean().optional(),
  movementId: z.string().uuid().nullable().optional(),
  contractVersion: z.string(),
});

export const inventoryCountQueueSchema = z.object({
  items: z.array(
    z.object({
      countId: z.string().uuid(),
      reference: z.string(),
      name: z.string(),
      variantLabel: z.string().nullable(),
      locationCode: z.string(),
      countedQuantity: z.coerce.number().nonnegative(),
      theoreticalQuantity: z.coerce.number().nullable(),
      difference: z.coerce.number().nullable(),
      blind: z.boolean(),
      status: z.string(),
      submittedBy: z.string(),
      submittedAt: z.string(),
      reviewNote: z.string().nullable(),
    }),
  ),
  pagination: inventoryPaginationSchema,
  contractVersion: z.string(),
});

export type InventoryList = z.infer<typeof inventoryListSchema>;
export type InventoryListItem = z.infer<typeof inventoryListItemSchema>;
export type InventoryMaterialDetail = z.infer<typeof inventoryMaterialDetailSchema>;
export type InventoryOrderTrace = z.infer<typeof inventoryOrderTraceSchema>;
export type InventoryLocation = z.infer<typeof inventoryLocationSchema>;
export type InventoryReceiptResult = z.infer<typeof inventoryReceiptResultSchema>;
export type InventoryReservationResult = z.infer<typeof inventoryReservationResultSchema>;
export type InventoryAdjustmentResult = z.infer<typeof inventoryAdjustmentResultSchema>;
export type InventoryCountResult = z.infer<typeof inventoryCountResultSchema>;
export type InventoryCountQueue = z.infer<typeof inventoryCountQueueSchema>;
