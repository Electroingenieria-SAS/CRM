import { z } from 'zod';

export const assistantAlertSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['ORDER_DELAY', 'INACTIVITY']),
  severity: z.enum(['info', 'warning', 'critical']),
  title: z.string(),
  message: z.string(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED']),
  targetProfileId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  shouldNotify: z.boolean(),
  updatedAt: z.string(),
});

export const assistantAlertsSchema = z.object({
  items: z.array(assistantAlertSchema),
  contractVersion: z.string(),
});

export const assistantRateLimitSchema = z.object({
  allowed: z.boolean(),
  retryAfterSeconds: z.number().int().nonnegative(),
  contractVersion: z.string(),
});

export const assistantMutationSchema = z.object({
  success: z.literal(true),
  contractVersion: z.string(),
}).passthrough();

export type AssistantAlert = z.infer<typeof assistantAlertSchema>;

export type PacoReplyAction = 'NONE' | 'NAVIGATE' | 'START_ACTIVITY_WIZARD' | 'CANCEL';

export interface PacoReply {
  text: string;
  action: PacoReplyAction;
  href?: string;
  suggestions?: string[];
}

export interface PacoActivityDraft {
  catalogId: string;
  assigneeProfileId: string;
  plannedStart: string;
  plannedEnd: string;
  orderId?: string;
  title?: string;
}
