import type { LogisticsPageActionDependencies } from './logistics-page-action-dependencies';

async function uploadEvidence(
  deps: LogisticsPageActionDependencies,
  orderId: string,
  type: string,
  file: File,
) {
  if (!deps.application || !deps.context) {
    throw new Error('La sesión no está disponible.');
  }
  return deps.application.logistics.uploadEvidence(
    deps.context.organization.id,
    orderId,
    type,
    file,
    crypto.randomUUID(),
  );
}

export function createLogisticsDeliveryActions(deps: LogisticsPageActionDependencies) {
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
        const evidenceId = await uploadEvidence(deps, orderId, 'DELIVERY_PHOTO', file);
        if (!evidenceId) throw new Error('No se pudo registrar la evidencia de entrega.');
        await deps.application!.logistics.deliver(
          shipmentId, orderId, receivedBy, observation,
          evidenceId, version, crypto.randomUUID(),
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
          ? await uploadEvidence(deps, orderId, 'DELIVERY_FAILED', file)
          : undefined;
        await deps.application!.logistics.failDelivery(
          shipmentId, orderId, reason, observation,
          evidenceId, version, crypto.randomUUID(),
        );
      }, 'Intento de entrega fallido registrado.'),
    reprogram: (shipmentId: string, version: number) =>
      deps.execute(
        () => deps.application!.logistics.reprogram(
          shipmentId, version, crypto.randomUUID(),
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
        const evidenceId = await uploadEvidence(deps, orderId, 'RETURN', file);
        if (!evidenceId) throw new Error('No se pudo registrar la evidencia de devolución.');
        await deps.application!.logistics.returnShipment(
          shipmentId, orderId, reason, evidenceId, version, crypto.randomUUID(),
        );
      }, 'Devolución registrada.'),
    satisfaction: (shipmentId: string, rating: number, comment?: string) =>
      deps.execute(
        () => deps.application!.logistics.satisfaction(
          shipmentId, rating, comment, crypto.randomUUID(),
        ),
        'Satisfacción registrada.',
      ),
    signOut: async () => {
      await deps.application?.auth.signOut();
      deps.goToLogin();
    },
  };
}
