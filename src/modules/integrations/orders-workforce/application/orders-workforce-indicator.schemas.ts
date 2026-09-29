import { z } from 'zod';

const occupancySchema = z.enum(['AVAILABLE', 'OCCUPIED', 'BLOCKED', 'OUT_OF_SCHEDULE']);

export const ordersWorkforceIndicatorSnapshotSchema = z.object({
  activeActivities: z.number().int().nonnegative(),
  occupiedPeople: z.number().int().nonnegative(),
  availablePeople: z.number().int().nonnegative(),
  blockedActivities: z.number().int().nonnegative(),
  operationalOrders: z.number().int().nonnegative(),
  completedActivities: z.number().int().nonnegative(),
  averageActivityMinutes: z.number().nonnegative(),
  averageMinutesByStep: z.record(z.string(), z.number().nonnegative()),
  ordersByStep: z.record(z.string(), z.number().int().nonnegative()),
  people: z.array(
    z.object({
      profileId: z.string().uuid(),
      name: z.string(),
      occupancy: occupancySchema,
      orderId: z.string().uuid().nullable(),
      orderNumber: z.string().nullable(),
      activityTitle: z.string().nullable(),
      activeBusinessMinutes: z.number().nonnegative(),
      blockedBusinessMinutes: z.number().nonnegative(),
      completedActivities: z.number().int().nonnegative(),
      inactivityMinutes: z.number().nonnegative().nullable(),
      excludedFromOccupancyMetrics: z.boolean(),
      excludedFromTimeMetrics: z.boolean(),
    }),
  ),
  orders: z.array(
    z.object({
      orderId: z.string().uuid(),
      orderNumber: z.string(),
      stepCode: z.string(),
      responsibleProfileId: z.string().uuid().nullable(),
      responsibleName: z.string().nullable(),
      sellerProfileId: z.string().uuid(),
      sellerName: z.string(),
      workforceActivityId: z.string().uuid().nullable(),
      workforceStatus: z.string().nullable(),
      businessMinutes: z.number().nonnegative(),
    }),
  ),
  contractVersion: z.string(),
});
