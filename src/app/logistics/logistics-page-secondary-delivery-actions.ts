import type { LogisticsPageActionDependencies } from './logistics-page-action-dependencies';
import { uploadLogisticsEvidence } from './logistics-page-evidence';

export function createLogisticsSecondaryDeliveryActions(deps: LogisticsPageActionDependencies) {
  return {
    reprogram: (shipmentId: string, version: number) =>
      deps.execute(
        () => deps.application!.logistics.reprogram(
          shipmentId,
          version,
          crypto.randomUUID(),
        ),
        'Entrega reprogramada.',
      ),
    returnWithFile: (
      shipmentId: string,
      orderId: string,
      version: number,
      reason: string,
      file: File,
    ) =>
      deps.execute(async () => {
        const evidenceId = await uploadLogisticsEvidence(deps, orderId, 'RETURN', file);
        if (!evidenceId) throw new Error('No se pudo registrar la evidencia de devolución.');
        await deps.application!.logistics.returnShipment(
          shipmentId,
          orderId,
          reason,
          evidenceId,
          version,
          crypto.randomUUID(),
        );
      }, 'Devolución registrada.'),
    satisfaction: (shipmentId: string, rating: number, comment?: string) =>
      deps.execute(
        () => deps.application!.logistics.satisfaction(
          shipmentId,
          rating,
          comment,
          crypto.randomUUID(),
        ),
        'Satisfacción registrada.',
      ),
    signOut: async () => {
      await deps.application?.auth.signOut();
      deps.goToLogin();
    },
  };
}
