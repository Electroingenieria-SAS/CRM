import { z } from 'zod';

export const workflowActionCodeSchema = z.enum([
  'CLAIM',
  'ASSIGN',
  'START',
  'BLOCK',
  'RESUME',
  'COMPLETE',
  'ISSUE_CREATE',
  'EVIDENCE_ADD',
  'CANCEL',
  'REOPEN',
]);

export const workflowActionSchema = z.object({
  code: workflowActionCodeSchema,
  label: z.string(),
  enabled: z.boolean(),
  reason: z.string().nullable().optional(),
  requires: z.array(z.string()).optional(),
});

export const workflowStateSchema = z.object({
  actions: z.array(workflowActionSchema),
  missingRequirements: z.array(z.record(z.string(), z.unknown())),
  blockingIssueOpen: z.boolean(),
});

export const assignmentCandidateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  employeeCode: z.string().nullable(),
  roles: z.array(z.string()),
});

export const workflowMutationResponseSchema = z.object({
  success: z.literal(true),
  idempotent: z.boolean(),
  orderId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  blockId: z.string().uuid().optional(),
  issueId: z.string().uuid().optional(),
  evidenceId: z.string().uuid().optional(),
  completedTaskId: z.string().uuid().optional(),
  assignedProfileId: z.string().uuid().optional(),
  currentStep: z.string().optional(),
  nextStep: z.string().optional(),
  status: z.string().optional(),
  version: z.number().int().positive().optional(),
});

export const blockTaskInputSchema = z.object({
  reasonCode: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
  detail: z.string().trim().min(3).max(1000),
});

export const issueInputSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  blocking: z.boolean().optional(),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(3).max(2000),
  responsibleProfileId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const evidenceInputSchema = z.object({
  evidenceType: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
  storageProvider: z.string().trim().min(1).max(40).default('EXTERNAL'),
  storageReference: z.string().trim().min(1).max(2000),
  fileName: z.string().trim().max(255).optional(),
  mimeType: z.string().trim().max(150).optional(),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(15 * 1024 * 1024)
    .optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type WorkflowAction = z.infer<typeof workflowActionSchema>;
export type WorkflowState = z.infer<typeof workflowStateSchema>;
export type WorkflowMutationResponse = z.infer<typeof workflowMutationResponseSchema>;
export type BlockTaskInput = z.input<typeof blockTaskInputSchema>;
export type IssueInput = z.input<typeof issueInputSchema>;
export type EvidenceInput = z.input<typeof evidenceInputSchema>;
export type AssignmentCandidate = z.infer<typeof assignmentCandidateSchema>;
