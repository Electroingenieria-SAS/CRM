import type { LogisticsPageActionDependencies } from './logistics-page-action-dependencies';
import { uploadLogisticsEvidence } from './logistics-page-evidence';

export function createLogisticsPrimaryDeliveryActions(deps: LogisticsPageActionDependencies) {
  return {
    deliverWithFile: (
      shipmentId: string,
      orderId: string,
      version: number,
      file: File,
      receivedBy?: string,
      observation?: string,
    ) =>
      deps.execute(async () => {
        const evidenceId = await uploadLogisticsEvidence(deps, orderId, 'DELIVERY_PHOTO', file);
        if (!evidenceId) throw new Error('No se pudo registrar la evidencia de entrega.');
        await deps.application!.logistics.deliver(
          shipmentId,
          orderId,
          receivedBy,
          observation,
          evidenceId,
          version,
          crypto.randomUUID(),
        );
      }, 'Entrega confirmada y enviada a cierre de Orders.'),
    failDelivery: (
      shipmentId: string,
      orderId: string,
      version: number,
      reason: string,
      observation?: string,
      file?: File,
    ) =>
      deps.execute(async () => {
        const evidenceId = file
          ? await uploadLogisticsEvidence(deps, orderId, 'DELIVERY_FAILED', file)
          : undefined;
        await deps.application!.logistics.failDelivery(
          shipmentId,
          orderId,
          reason,
          observation,
          evidenceId,
          version,
          crypto.randomUUID(),
        );
      }, 'Intento de entrega fallido registrado.'),
  };
}
