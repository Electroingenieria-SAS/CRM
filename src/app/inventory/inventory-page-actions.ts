import type { Dispatch, SetStateAction } from 'react';
import type { InventoryBrowserApplication } from '@/composition/inventory-browser-application';
import type {
  InventoryList,
  InventoryMaterialDetail,
} from '@/modules/inventory/application/inventory.schemas';
import type {
  InventoryReceiveInput,
  InventoryReserveInput,
} from '@/modules/inventory/ports/inventory-repository';

interface ActionContext {
  application: InventoryBrowserApplication | null;
  detail: InventoryMaterialDetail | null;
  list: InventoryList | null;
  loadList(page?: number): Promise<void>;
  reloadDetail(): Promise<void>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
}

async function runMutation(
  context: ActionContext,
  operation: () => Promise<unknown>,
  success: string,
) {
  context.setBusy(true);
  context.setMessage(null);
  context.setNotice(null);
  try {
    await operation();
    await Promise.all([
      context.loadList(context.list?.pagination.page ?? 1),
      context.reloadDetail(),
    ]);
    context.setNotice(success);
  } catch (error) {
    context.setMessage(
      error instanceof Error ? error.message : 'No fue posible actualizar Inventario.',
    );
  } finally {
    context.setBusy(false);
  }
}

export function createInventoryPageActions(context: ActionContext) {
  const { application, detail } = context;
  const mutate = (operation: () => Promise<unknown>, success: string) =>
    runMutation(context, operation, success);

  const receive = (input: Omit<InventoryReceiveInput, 'materialId' | 'variantId' | 'unit'>) => {
    if (!application || !detail) return Promise.resolve();
    return mutate(
      () =>
        application.inventory.receive(
          {
            ...input,
            materialId: detail.material.id,
            variantId: detail.material.variant?.id,
            unit: detail.material.unit,
          },
          crypto.randomUUID(),
        ),
      'Entrada registrada con trazabilidad.',
    );
  };

  const reserve = (input: Omit<InventoryReserveInput, 'materialId' | 'variantId' | 'unit'>) => {
    if (!application || !detail) return Promise.resolve();
    return mutate(
      () =>
        application.inventory.reserve(
          {
            ...input,
            materialId: detail.material.id,
            variantId: detail.material.variant?.id,
            unit: detail.material.unit,
          },
          crypto.randomUUID(),
        ),
      'Reserva confirmada.',
    );
  };

  const action = (
    operation: (app: InventoryBrowserApplication) => Promise<unknown>,
    success: string,
  ) => (application ? mutate(() => operation(application), success) : Promise.resolve());

  return {
    receive,
    reserve,
    release: (reservationId: string, reason: string) =>
      action(
        (app) => app.inventory.release(reservationId, undefined, reason, crypto.randomUUID()),
        'Reserva liberada.',
      ),
    pick: (reservationId: string) =>
      action(
        (app) => app.inventory.pick(reservationId, undefined, crypto.randomUUID()),
        'Material comprometido para picking.',
      ),
    consume: (reservationId: string, reason: string) =>
      action(
        (app) => app.inventory.consume(reservationId, undefined, reason, crypto.randomUUID()),
        'Consumo registrado.',
      ),
    returnReusable: (reservationId: string, reason: string) =>
      action(
        (app) =>
          app.inventory.returnReusable(reservationId, undefined, reason, crypto.randomUUID()),
        'Sobrante reutilizable devuelto.',
      ),
    waste: (reservationId: string, reason: string) =>
      action(
        (app) => app.inventory.waste(reservationId, undefined, reason, crypto.randomUUID()),
        'Desperdicio registrado.',
      ),
    adjust: (balanceId: string, delta: number, reason: string) =>
      action(
        (app) => app.inventory.adjust(balanceId, delta, reason, crypto.randomUUID()),
        'Ajuste aplicado y auditado.',
      ),
  };
}
