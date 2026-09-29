import type { LogisticsReleaseInput } from '@/modules/logistics/ports/logistics-ports';
import type { LogisticsPageActionDependencies } from './logistics-page-action-dependencies';

async function searchCandidates(deps: LogisticsPageActionDependencies) {
  if (!deps.application) return;
  deps.setBusy(true);
  deps.setMessage(null);
  try {
    deps.setCandidates(await deps.application.logistics.candidates(deps.candidateSearch, 1, 25));
  } catch (error) {
    deps.setMessage(error instanceof Error ? error.message : 'No fue posible buscar candidatos.');
  } finally {
    deps.setBusy(false);
  }
}

async function estimateFreight(
  deps: LogisticsPageActionDependencies,
  orderId: string,
  routeCode: 'LOCAL_DISPATCH' | 'NATIONAL_DISPATCH',
  destinationId: string,
  carrierId?: string,
) {
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
}

export function createLogisticsReleaseActions(deps: LogisticsPageActionDependencies) {
  return {
    searchCandidates: () => searchCandidates(deps),
    searchQueue: () => deps.loadQueue(deps.query),
    estimate: (
      orderId: string,
      routeCode: 'LOCAL_DISPATCH' | 'NATIONAL_DISPATCH',
      destinationId: string,
      carrierId?: string,
    ) => estimateFreight(deps, orderId, routeCode, destinationId, carrierId),
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
    dispatch: (shipmentId: string, orderId: string, version: number, actualFreight?: number) =>
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
          deps.application!.logistics.setActualCost(shipmentId, cost, version, crypto.randomUUID()),
        'Costo real actualizado.',
      ),
  };
}
