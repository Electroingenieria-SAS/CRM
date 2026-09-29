import type { SupabaseClient } from '@supabase/supabase-js';
import { workforceMutationResponseSchema } from '@/modules/workforce/application/workforce.schemas';
import type { WorkforceService } from '@/modules/workforce/application/workforce-service';
import type {
  WorkforceAutomationKeys,
  WorkforceAutomationPort,
} from '@/modules/integrations/orders-workforce/application/orders-workforce.ports';
import type {
  OrderWorkforceEvent,
  WorkforceAutomationResult,
} from '@/modules/integrations/orders-workforce/application/orders-workforce.schemas';
import { AppError } from '@/shared/errors/app-error';

function integrationError(error: { code?: string; message?: string } | null): AppError {
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', 'No tienes permisos para sincronizar esta actividad.');
  }
  if (error?.code === '23514') {
    return new AppError('BUSINESS_RULE', 'Falta la evidencia requerida para cerrar la actividad.');
  }
  if (error?.code === '23P01') {
    return new AppError('BUSINESS_RULE', 'La persona ya tiene una actividad incompatible.');
  }
  if (error?.code === '40001') {
    return new AppError('BUSINESS_RULE', 'La actividad cambió durante la sincronización.');
  }
  return new AppError(
    'DATABASE',
    error?.message ?? 'No fue posible sincronizar Orders con Workforce.',
  );
}

function resultFromMutation(
  mutation: ReturnType<typeof workforceMutationResponseSchema.parse>,
): WorkforceAutomationResult {
  return {
    activityId: mutation.activityId,
    status: mutation.status ?? 'PLANNED',
    idempotent: mutation.idempotent,
    metadata: {
      version: mutation.version,
      assigneeProfileId: mutation.assigneeProfileId,
    },
  };
}

export class SupabaseWorkforceAutomationAdapter implements WorkforceAutomationPort {
  constructor(
    private readonly client: SupabaseClient,
    private readonly workforce: WorkforceService,
  ) {}

  async applyOrderEvent(
    event: OrderWorkforceEvent,
    keys: WorkforceAutomationKeys,
    existingActivityId: string | null,
  ): Promise<WorkforceAutomationResult> {
    if (event.integrationEvent === 'OrderTaskClaimed') {
      return existingActivityId
        ? this.current(existingActivityId)
        : this.create(event, keys.activityKey);
    }

    if (event.integrationEvent === 'OrderTaskAssigned') {
      return existingActivityId
        ? this.reassign(existingActivityId, event, keys.eventKey)
        : this.create(event, keys.activityKey);
    }

    if (event.integrationEvent === 'OrderTaskStarted') {
      return this.start(await this.ensureActivity(event, keys, existingActivityId), keys.eventKey);
    }

    if (event.integrationEvent === 'OrderBlocked') {
      return this.block(await this.ensureActivity(event, keys, existingActivityId), event, keys);
    }

    if (event.integrationEvent === 'OrderTaskResumed') {
      return this.resume(await this.ensureActivity(event, keys, existingActivityId), keys.eventKey);
    }

    if (event.integrationEvent === 'OrderTaskCompleted') {
      return this.complete(await this.ensureActivity(event, keys, existingActivityId), event, keys);
    }

    if (event.integrationEvent === 'OrderCancelled') {
      return this.cancel(await this.ensureActivity(event, keys, existingActivityId), keys.eventKey);
    }

    return this.reconcile(event, keys, existingActivityId);
  }

  async assertOrderCompletionReady(orderId: string): Promise<void> {
    const { data, error } = await this.client.rpc('erp_x_order_workforce_completion_readiness', {
      p_order_id: orderId,
    });
    if (error) throw integrationError(error);

    const readiness = (data ?? {}) as {
      ready?: boolean;
      reason?: string | null;
      evidenceComplete?: boolean;
    };
    if (readiness.ready) return;

    if (readiness.reason === 'WORKFORCE_EVIDENCE_REQUIRED') {
      throw new AppError(
        'BUSINESS_RULE',
        'Debes registrar la evidencia requerida en Workforce antes de completar esta etapa.',
      );
    }

    throw new AppError(
      'BUSINESS_RULE',
      'La actividad Workforce debe estar en curso y sincronizada antes de completar la etapa.',
    );
  }

  private async ensureActivity(
    event: OrderWorkforceEvent,
    keys: WorkforceAutomationKeys,
    activityId: string | null,
  ) {
    if (activityId) return activityId;
    const created = await this.create(event, keys.activityKey);
    return created.activityId;
  }

  private async current(activityId: string): Promise<WorkforceAutomationResult> {
    const detail = await this.workforce.detail(activityId);
    return {
      activityId,
      status: detail.activity.status,
      idempotent: true,
      metadata: {
        version: detail.activity.version,
        assigneeProfileId: detail.activity.assigneeProfileId,
      },
    };
  }

  private async create(event: OrderWorkforceEvent, key: string) {
    const { data, error } = await this.client.rpc('erp_x_workforce_create_from_order_event', {
      p_event: event,
      p_idempotency_key: key,
    });
    if (error) throw integrationError(error);
    return resultFromMutation(workforceMutationResponseSchema.parse(data));
  }

  private async reassign(activityId: string, event: OrderWorkforceEvent, key: string) {
    const { data, error } = await this.client.rpc('erp_x_workforce_reassign_from_order_event', {
      p_activity_id: activityId,
      p_event: event,
      p_event_key: key,
    });
    if (error) throw integrationError(error);
    return resultFromMutation(workforceMutationResponseSchema.parse(data));
  }

  private async start(activityId: string, key: string) {
    const detail = await this.workforce.detail(activityId);
    if (detail.activity.status === 'IN_PROGRESS' || detail.activity.status === 'BLOCKED') {
      return this.current(activityId);
    }
    if (detail.activity.status !== 'PLANNED') return this.current(activityId);
    return resultFromMutation(await this.workforce.start(activityId, detail.activity.version, key));
  }

  private async block(
    activityId: string,
    event: OrderWorkforceEvent,
    keys: WorkforceAutomationKeys,
  ) {
    let detail = await this.workforce.detail(activityId);
    if (detail.activity.status === 'BLOCKED') return this.current(activityId);

    if (detail.activity.status === 'PLANNED') {
      await this.workforce.start(activityId, detail.activity.version, `${keys.eventKey}:start`);
      detail = await this.workforce.detail(activityId);
    }

    if (detail.activity.status !== 'IN_PROGRESS') return this.current(activityId);
    const reason =
      typeof event.orderPayload?.detail === 'string'
        ? event.orderPayload.detail
        : 'Bloqueo sincronizado desde el workflow del pedido';

    return resultFromMutation(
      await this.workforce.block(activityId, reason, detail.activity.version, keys.eventKey),
    );
  }

  private async resume(activityId: string, key: string) {
    const detail = await this.workforce.detail(activityId);
    if (detail.activity.status === 'IN_PROGRESS') return this.current(activityId);
    if (detail.activity.status === 'PLANNED') return this.start(activityId, key);
    if (detail.activity.status !== 'BLOCKED') return this.current(activityId);
    return resultFromMutation(
      await this.workforce.resume(activityId, detail.activity.version, key),
    );
  }

  private async complete(
    activityId: string,
    event: OrderWorkforceEvent,
    keys: WorkforceAutomationKeys,
  ) {
    let detail = await this.workforce.detail(activityId);
    if (detail.activity.status === 'COMPLETED') return this.current(activityId);

    if (detail.activity.status === 'PLANNED') {
      await this.workforce.start(activityId, detail.activity.version, `${keys.eventKey}:start`);
      detail = await this.workforce.detail(activityId);
    } else if (detail.activity.status === 'BLOCKED') {
      await this.workforce.resume(activityId, detail.activity.version, `${keys.eventKey}:resume`);
      detail = await this.workforce.detail(activityId);
    }

    return resultFromMutation(
      await this.workforce.complete(
        activityId,
        `Etapa ${event.stepCode} completada desde Orders.`,
        detail.activity.version,
        keys.eventKey,
      ),
    );
  }

  private async cancel(activityId: string, key: string) {
    const detail = await this.workforce.detail(activityId);
    if (detail.activity.status === 'CANCELLED' || detail.activity.status === 'COMPLETED') {
      return this.current(activityId);
    }
    return resultFromMutation(
      await this.workforce.cancel(
        activityId,
        'Pedido cancelado desde Orders.',
        detail.activity.version,
        key,
      ),
    );
  }

  private async reconcile(
    event: OrderWorkforceEvent,
    keys: WorkforceAutomationKeys,
    activityId: string | null,
  ) {
    const ensured = await this.ensureActivity(event, keys, activityId);
    if (event.orderTaskStatus === 'IN_PROGRESS') return this.start(ensured, keys.eventKey);
    if (event.orderTaskStatus === 'BLOCKED') return this.block(ensured, event, keys);
    return this.current(ensured);
  }
}
