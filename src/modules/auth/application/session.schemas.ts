import { z } from 'zod';

export const moduleAccessSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  canRead: z.boolean(),
  canCreate: z.boolean(),
  canUpdate: z.boolean(),
  canApprove: z.boolean(),
  canAdmin: z.boolean(),
});

export const sessionContextSchema = z.object({
  profile: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    employeeCode: z.string().nullable(),
    roles: z.array(z.string()),
    preferences: z.record(z.string(), z.unknown()),
  }),
  organization: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    timezone: z.string(),
    settings: z.record(z.string(), z.unknown()),
  }),
  modules: z.array(moduleAccessSchema),
  catalogs: z.object({
    orderTypes: z.array(z.record(z.string(), z.unknown())),
    paymentConditions: z.array(z.record(z.string(), z.unknown())),
    deliveryRoutes: z.array(z.record(z.string(), z.unknown())),
    steps: z.array(z.record(z.string(), z.unknown())),
    priorities: z.array(z.string()),
  }),
  serverTime: z.string(),
  contractVersion: z.string(),
});

export type SessionContext = z.infer<typeof sessionContextSchema>;
export type ModuleAccess = z.infer<typeof moduleAccessSchema>;
