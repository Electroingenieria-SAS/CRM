import type { SupabaseClient } from '@supabase/supabase-js';
import type { LogisticsWorkforceEvidencePort } from '@/modules/logistics/ports/logistics-ports';
import { AppError } from '@/shared/errors/app-error';

interface WorkforceReadiness {
  ready?: boolean;
  mapped?: boolean;
  activityId?: string;
  status?: string;
  evidenceComplete?: boolean;
  reason?: string | null;
}

function workforceError(error: { code?: string; message?: string } | null) {
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', 'No tienes permisos para registrar evidencia Workforce.');
  }
  if (error?.code === '23514' || error?.code === '22023') {
    return new AppError(
      'BUSINESS_RULE',
      error.message ?? 'La evidencia no cumple la política Workforce.',
    );
  }
  return new AppError(
    'DATABASE',
    error?.message ?? 'No fue posible sincronizar la evidencia con Workforce.',
  );
}

export class SupabaseLogisticsWorkforceEvidenceAdapter
  implements LogisticsWorkforceEvidencePort
{
  constructor(private readonly client: SupabaseClient) {}

  async attachFinalEvidence(
    orderId: string,
    input: {
      storageProvider: string;
      storageReference: string;
      fileName?: string;
      mimeType?: string;
      sizeBytes?: number;
    },
    key: string,
  ) {
    if (!input.mimeType?.startsWith('image/')) {
      throw new AppError(
        'VALIDATION',
        'La entrega requiere una fotografía para completar la actividad Workforce.',
      );
    }

    const { data, error } = await this.client.rpc(
      'erp_x_order_workforce_completion_readiness',
      { p_order_id: orderId },
    );
    if (error) throw workforceError(error);

    const readiness = (data ?? {}) as WorkforceReadiness;
    if (readiness.ready && readiness.evidenceComplete) return;
    if (readiness.mapped === false) return;
    if (!readiness.activityId) {
      throw new AppError(
        'BUSINESS_RULE',
        'No existe una actividad Workforce activa para registrar la evidencia de entrega.',
      );
    }

    const { error: evidenceError } = await this.client.rpc('erp_x_workforce_add_evidence', {
      p_activity_id: readiness.activityId,
      p_evidence: {
        evidenceType: 'FINAL_PHOTO',
        storageProvider: input.storageProvider,
        storageReference: input.storageReference,
        fileName: input.fileName ?? null,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        metadata: {
          source: 'LOGISTICS',
          orderId,
          sharedStorageReference: true,
        },
      },
      p_idempotency_key: key,
    });
    if (evidenceError) throw workforceError(evidenceError);
  }
}
