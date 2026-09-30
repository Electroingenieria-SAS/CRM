import type { SupabaseClient } from '@supabase/supabase-js';
import type { LogisticsWorkforceEvidencePort } from '@/modules/logistics/ports/logistics-ports';
import type { StoredOrderEvidence } from '@/shared/evidence/order-evidence-storage';
import { AppError } from '@/shared/errors/app-error';

function mapError(error: { code?: string; message?: string } | null) {
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', 'No tienes permisos para adjuntar evidencia Workforce.');
  }
  if (error?.code === '22023' || error?.code === '23514') {
    return new AppError('BUSINESS_RULE', error.message ?? 'La evidencia Workforce no es válida.');
  }
  return new AppError('DATABASE', error?.message ?? 'No fue posible sincronizar la evidencia Workforce.');
}

export class SupabaseLogisticsWorkforceEvidenceAdapter
  implements LogisticsWorkforceEvidencePort
{
  constructor(private readonly client: SupabaseClient) {}

  async attachFinalEvidence(orderId: string, evidence: StoredOrderEvidence, key: string) {
    if (!evidence.mimeType.startsWith('image/')) {
      throw new AppError(
        'VALIDATION',
        'La entrega requiere una evidencia fotográfica para cerrar la actividad Workforce.',
      );
    }

    const { data: readiness, error: readinessError } = await this.client.rpc(
      'erp_x_order_workforce_completion_readiness',
      { p_order_id: orderId },
    );
    if (readinessError) throw mapError(readinessError);

    const state = (readiness ?? {}) as {
      mapped?: boolean;
      ready?: boolean;
      evidenceComplete?: boolean;
      activityId?: string;
    };

    if (!state.mapped || state.evidenceComplete || state.ready) return;
    if (!state.activityId) {
      throw new AppError(
        'BUSINESS_RULE',
        'La actividad Workforce todavía no está disponible para adjuntar la evidencia final.',
      );
    }

    const { error } = await this.client.rpc('erp_x_workforce_add_evidence', {
      p_activity_id: state.activityId,
      p_evidence: {
        evidenceType: 'FINAL_PHOTO',
        storageProvider: evidence.storageProvider,
        storageReference: evidence.storageReference,
        fileName: evidence.fileName,
        mimeType: evidence.mimeType,
        sizeBytes: evidence.sizeBytes,
        metadata: {
          source: 'LOGISTICS_DELIVERY',
          orderId,
          reusedStorageReference: true,
        },
      },
      p_idempotency_key: key,
    });
    if (error) throw mapError(error);
  }
}
