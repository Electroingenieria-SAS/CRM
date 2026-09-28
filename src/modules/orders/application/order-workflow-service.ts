import type { OrderWorkflowMutationObserver } from '@/modules/orders/application/order-workflow-observer';
import type { OrderWorkflowRepository } from '@/modules/orders/application/order-workflow-repository';
import {
  blockTaskInputSchema,
  evidenceInputSchema,
  issueInputSchema,
  type WorkflowMutationResponse,
} from '@/modules/orders/application/order-workflow.schemas';

function requireKey(value: string) {
  const key = value.trim();
  if (!key) throw new Error('La clave de idempotencia es obligatoria.');
  return key;
}

function requireVersion(version: number) {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('La versión operativa del pedido es inválida.');
  }
  return version;
}

export class OrderWorkflowService {
  constructor(
    private readonly repository: OrderWorkflowRepository,
    private readonly observer?: OrderWorkflowMutationObserver,
  ) {}

  private async mutate(operation: () => Promise<WorkflowMutationResponse>) {
    const result = await operation();

    if (this.observer) {
      try {
        await this.observer.onWorkflowMutation(result);
      } catch {
        // Orders is already committed and the durable outbox remains visible/retryable.
      }
    }

    return result;
  }

  claim(orderId: string, version: number, key: string) {
    const expectedVersion = requireVersion(version);
    const idempotencyKey = requireKey(key);
    return this.mutate(() => this.repository.claim(orderId, expectedVersion, idempotencyKey));
  }

  assign(orderId: string, profileId: string, version: number, key: string) {
    const assigneeProfileId = profileId.trim();
    if (!assigneeProfileId) throw new Error('Selecciona un responsable.');
    const expectedVersion = requireVersion(version);
    const idempotencyKey = requireKey(key);
    return this.mutate(() =>
      this.repository.assign(orderId, assigneeProfileId, expectedVersion, idempotencyKey),
    );
  }

  start(orderId: string, version: number, key: string) {
    const expectedVersion = requireVersion(version);
    const idempotencyKey = requireKey(key);
    return this.mutate(() => this.repository.start(orderId, expectedVersion, idempotencyKey));
  }

  block(orderId: string, input: unknown, version: number, key: string) {
    const blockInput = blockTaskInputSchema.parse(input);
    const expectedVersion = requireVersion(version);
    const idempotencyKey = requireKey(key);
    return this.mutate(() =>
      this.repository.block(orderId, blockInput, expectedVersion, idempotencyKey),
    );
  }

  resume(orderId: string, resolution: string, version: number, key: string) {
    const normalized = resolution.trim();
    if (normalized.length < 3) throw new Error('Describe cómo se resolvió el bloqueo.');
    const expectedVersion = requireVersion(version);
    const idempotencyKey = requireKey(key);
    return this.mutate(() =>
      this.repository.resume(orderId, normalized, expectedVersion, idempotencyKey),
    );
  }

  complete(orderId: string, resultCode: string, detail: string, version: number, key: string) {
    const normalizedResult = resultCode.trim() || 'COMPLETED';
    const normalizedDetail = detail.trim();
    const expectedVersion = requireVersion(version);
    const idempotencyKey = requireKey(key);
    return this.mutate(() =>
      this.repository.complete(
        orderId,
        normalizedResult,
        normalizedDetail,
        expectedVersion,
        idempotencyKey,
      ),
    );
  }

  cancel(orderId: string, reason: string, version: number, key: string) {
    const normalized = reason.trim();
    if (normalized.length < 3) throw new Error('Indica la razón de cancelación.');
    const expectedVersion = requireVersion(version);
    const idempotencyKey = requireKey(key);
    return this.mutate(() =>
      this.repository.cancel(orderId, normalized, expectedVersion, idempotencyKey),
    );
  }

  reopen(orderId: string, targetStep: string, reason: string, version: number, key: string) {
    const normalizedReason = reason.trim();
    if (!targetStep.trim()) throw new Error('Selecciona la etapa de reapertura.');
    if (normalizedReason.length < 3) throw new Error('Indica la razón de reapertura.');
    return this.repository.reopen(
      orderId,
      targetStep.trim().toUpperCase(),
      normalizedReason,
      requireVersion(version),
      requireKey(key),
    );
  }

  createIssue(orderId: string, input: unknown, key: string) {
    return this.repository.createIssue(orderId, issueInputSchema.parse(input), requireKey(key));
  }

  resolveIssue(issueId: string, resolution: string, key: string) {
    const normalized = resolution.trim();
    if (normalized.length < 3) throw new Error('Describe la resolución.');
    return this.repository.resolveIssue(issueId, normalized, requireKey(key));
  }

  addEvidence(orderId: string, input: unknown, key: string) {
    return this.repository.addEvidence(orderId, evidenceInputSchema.parse(input), requireKey(key));
  }
}
