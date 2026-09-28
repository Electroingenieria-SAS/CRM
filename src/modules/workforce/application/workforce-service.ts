import {
  createWorkforceActivitySchema,
  workforceEvidenceInputSchema,
  type CreateWorkforceActivityInput,
} from '@/modules/workforce/application/workforce.schemas';
import type { EvidenceStoragePort } from '@/modules/workforce/application/evidence-storage-port';
import type { WorkforceRepository } from '@/modules/workforce/application/workforce-repository';

function requiredText(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

function positiveVersion(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('La versión de la actividad es inválida.');
  }
  return value;
}

export class WorkforceService {
  constructor(
    private readonly repository: WorkforceRepository,
    private readonly evidenceStorage: EvidenceStoragePort,
  ) {}

  catalog() {
    return this.repository.catalog();
  }

  schedule(from: string, to: string, profileId?: string) {
    return this.repository.schedule(from, to, profileId);
  }

  detail(activityId: string) {
    return this.repository.detail(requiredText(activityId, 'La actividad es obligatoria.'));
  }

  indicators(from: string, to: string) {
    return this.repository.indicators(from, to);
  }

  create(input: CreateWorkforceActivityInput, idempotencyKey: string) {
    return this.repository.create(
      createWorkforceActivitySchema.parse(input),
      requiredText(idempotencyKey, 'La clave de idempotencia es obligatoria.'),
    );
  }

  assign(activityId: string, assigneeProfileId: string | null, version: number, key: string) {
    return this.repository.assign(
      requiredText(activityId, 'La actividad es obligatoria.'),
      assigneeProfileId?.trim() || null,
      positiveVersion(version),
      requiredText(key, 'La clave de idempotencia es obligatoria.'),
    );
  }

  start(activityId: string, version: number, key: string) {
    return this.repository.start(
      activityId,
      positiveVersion(version),
      requiredText(key, 'La clave de idempotencia es obligatoria.'),
    );
  }

  block(activityId: string, reason: string, version: number, key: string) {
    return this.repository.block(
      activityId,
      requiredText(reason, 'El motivo de bloqueo es obligatorio.'),
      positiveVersion(version),
      requiredText(key, 'La clave de idempotencia es obligatoria.'),
    );
  }

  resume(activityId: string, version: number, key: string) {
    return this.repository.resume(
      activityId,
      positiveVersion(version),
      requiredText(key, 'La clave de idempotencia es obligatoria.'),
    );
  }

  complete(activityId: string, resultNote: string, version: number, key: string) {
    return this.repository.complete(
      activityId,
      resultNote.trim(),
      positiveVersion(version),
      requiredText(key, 'La clave de idempotencia es obligatoria.'),
    );
  }

  cancel(activityId: string, reason: string, version: number, key: string) {
    return this.repository.cancel(
      activityId,
      requiredText(reason, 'El motivo de cancelación es obligatorio.'),
      positiveVersion(version),
      requiredText(key, 'La clave de idempotencia es obligatoria.'),
    );
  }

  async uploadEvidence(input: {
    organizationId: string;
    activityId: string;
    evidenceType: 'BEFORE_PHOTO' | 'AFTER_PHOTO' | 'FINAL_PHOTO' | 'FILE';
    file: File;
    idempotencyKey: string;
  }) {
    const stored = await this.evidenceStorage.upload(input);
    const evidence = workforceEvidenceInputSchema.parse({
      evidenceType: input.evidenceType,
      ...stored,
    });

    return this.repository.addEvidence(
      input.activityId,
      evidence,
      requiredText(input.idempotencyKey, 'La clave de idempotencia es obligatoria.'),
    );
  }
}
