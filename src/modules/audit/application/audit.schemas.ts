import { z } from 'zod';

export const auditEventSchema = z.object({
  id: z.number().int().positive(),
  createdAt: z.string(),
  actorId: z.string().uuid().nullable(),
  actor: z.string(),
  actorKind: z.enum(['USER', 'SYSTEM', 'SERVICE']),
  module: z.string(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  result: z.enum(['SUCCESS', 'FAILED', 'DENIED', 'REQUESTED', 'ACKNOWLEDGED']),
  requestId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export const auditResponseSchema = z.object({
  items: z.array(auditEventSchema),
  range: z.object({
    from: z.string(),
    to: z.string(),
    timezone: z.string(),
  }),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
  contractVersion: z.string(),
});

export interface AuditQuery {
  from?: string;
  to?: string;
  actorId?: string;
  module?: string;
  action?: string;
  resource?: string;
  result?: string;
  page?: number;
  pageSize?: number;
}

export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AuditResponse = z.infer<typeof auditResponseSchema>;
