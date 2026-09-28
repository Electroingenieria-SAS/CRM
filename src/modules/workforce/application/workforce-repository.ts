import type {
  CreateWorkforceActivityInput,
  WorkforceActivityDetailResponse,
  WorkforceCatalogResponse,
  WorkforceEvidenceInput,
  WorkforceIndicatorsResponse,
  WorkforceMutationResponse,
  WorkforceScheduleResponse,
} from '@/modules/workforce/application/workforce.schemas';

export interface WorkforceRepository {
  catalog(): Promise<WorkforceCatalogResponse>;
  schedule(from: string, to: string, profileId?: string): Promise<WorkforceScheduleResponse>;
  detail(activityId: string): Promise<WorkforceActivityDetailResponse>;
  indicators(from: string, to: string): Promise<WorkforceIndicatorsResponse>;
  create(
    input: CreateWorkforceActivityInput,
    idempotencyKey: string,
  ): Promise<WorkforceMutationResponse>;
  assign(
    activityId: string,
    assigneeProfileId: string | null,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<WorkforceMutationResponse>;
  start(
    activityId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<WorkforceMutationResponse>;
  block(
    activityId: string,
    reason: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<WorkforceMutationResponse>;
  resume(
    activityId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<WorkforceMutationResponse>;
  complete(
    activityId: string,
    resultNote: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<WorkforceMutationResponse>;
  cancel(
    activityId: string,
    reason: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<WorkforceMutationResponse>;
  addEvidence(
    activityId: string,
    evidence: WorkforceEvidenceInput,
    idempotencyKey: string,
  ): Promise<WorkforceMutationResponse>;
}
