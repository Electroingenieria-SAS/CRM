import type {
  LogisticsBrowserApplication,
} from '@/composition/logistics-browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { FreightPredictionResult } from '@/modules/freight/application/freight-prediction.schemas';
import type { LogisticsCandidates } from '@/modules/logistics/application/logistics.schemas';
import type {
  LogisticsQueueQuery,
  LogisticsReleaseInput,
} from '@/modules/logistics/ports/logistics-ports';

interface LogisticsPageActionDependencies {
  application: LogisticsBrowserApplication | null;
  context: SessionContext | null;
  candidateSearch: string;
  query: LogisticsQueueQuery;
  execute(operation: () => Promise<unknown>, success: string): Promise<void>;
  loadQueue(query: LogisticsQueueQuery): Promise<void>;
  setCandidates(value: LogisticsCandidates): void;
  setPrediction(value: FreightPredictionResult | null): void;
  setBusy(value: boolean): void;
  setMessage(value: string | null): void;
  goToLogin(): void;
}

export function createLogisticsPageActions(deps: LogisticsPageActionDependencies) {
  return {
    searchCandidates: async () => {
      if (!deps.application) return;
      deps.setBusy(true);
      deps.setMessage(null);
      try {
        deps.setCandidates(
          await deps.application.logistics.candidates(deps.candidateSearch, 1, 25),
        );
      } catch (error) {
        deps.setMessage(
          error instanceof Error ? error.message : 'No fue posible buscar candidatos.',
        );
      } finally {
        deps.setBusy(false);
      }
    },
    searchQueue: () => deps.loadQueue(deps.query),
    estimate: async (
      orderId: string,
      routeCode: 'LOCAL_DISPATCH' | 'NATIONAL_DISPATCH',
      destinationId: string,
      carrierId?: string,
    ) => {
      if (!deps.application) return;
      deps.setBusy(true);
      deps.setMessage(null);
      try {
        const response = await deps.application.freight.predict({
          orderId,
          routeCode,
          destinationId,
          carrierId: carrierId || undefined,
        });
        deps.setPrediction(response.results[0] ?? null);
      } catch (error) {
        deps.setMessage(error instanceof Error ? error.message : 'No fue posible estimar el flete.');
      } finally {
        deps.setBusy(false);
      }
    },
    release: (orderId: string, input: LogisticsReleaseInput) =>
      deps.execute(
        () => deps.application!.logistics.release(orderId, input, crypto.randomUUID()),
        'Pedido liberado a logística.',
      ),
    saveGuide: (shipmentId: string, carrierId: string, tracking: string) =>
      deps.execute(
        () =>
          deps.application!.logistics.saveGuide(
            shipmentId,
            carrierId,
            tracking,
            crypto.randomUUID(),
          ),
        'Guía registrada.',
      ),
    dispatch: (
      shipmentId: string,
      orderId: string,
      version: number,
      actualFreight?: number,
    ) =>
      deps.execute(
        () =>
          deps.application!.logistics.dispatch(
            shipmentId,
            orderId,
            version,
            actualFreight,
            crypto.randomUUID(),
          ),
        'Despacho registrado.',
      ),
    setActualCost: (shipmentId: string, version: number, cost: number) =>
      deps.execute(
        () =>
          deps.application!.logistics.setActualCost(
            shipmentId,
            cost,
            version,
            crypto.randomUUID(),
          ),
        'Costo real actualizado.',
      ),
    deliverWithFile: (
      shipmentId: string,
      orderId: string,
      version: number,
      file: File,
      receivedBy?: string,
      observation?: string,
    ) =>
      deps.execute(async () => {
        if (!deps.context) throw new Error('La sesión no está disponible.');
        const evidenceId = await deps.application!.logistics.uploadEvidence(
          deps.context.organization.id,
          orderId,
          'DELIVERY_PHOTO',
          file,
          crypto.randomUUID(),
        );
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
        if (!deps.context) throw new Error('La sesión no está disponible.');
        const evidenceId = file
          ? await deps.application!.logistics.uploadEvidence(
              deps.context.organization.id,
              orderId,
              'DELIVERY_FAILED',
              file,
              crypto.randomUUID(),
            )
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
    reprogram: (shipmentId: string, version: number) =>
      deps.execute(
        () => deps.application!.logistics.reprogram(shipmentId, version, crypto.randomUUID()),
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
        if (!deps.context) throw new Error('La sesión no está disponible.');
        const evidenceId = await deps.application!.logistics.uploadEvidence(
          deps.context.organization.id,
          orderId,
          'RETURN',
          file,
          crypto.randomUUID(),
        );
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
        () =>
          deps.application!.logistics.satisfaction(
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
