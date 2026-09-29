'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createInventoryBrowserApplication,
  type InventoryBrowserApplication,
} from '@/composition/inventory-browser-application';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  InventoryList,
  InventoryLocation,
  InventoryMaterialDetail,
} from '@/modules/inventory/application/inventory.schemas';
import type {
  InventoryReceiveInput,
  InventoryReserveInput,
} from '@/modules/inventory/ports/inventory-repository';

async function initialData(application: InventoryBrowserApplication) {
  const context = await application.auth.restoreContext();
  if (!context) return null;
  if (!hasModuleCapability(context, 'inventory', 'read')) {
    throw new Error('No tienes permiso para consultar Inventario.');
  }
  const [locations, list] = await Promise.all([
    application.inventory.locations(),
    application.inventory.list(),
  ]);
  return { context, locations, list };
}

export function useInventoryPage() {
  const router = useRouter();
  const application = useMemo(() => createInventoryBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [list, setList] = useState<InventoryList | null>(null);
  const [detail, setDetail] = useState<InventoryMaterialDetail | null>(null);
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const goLogin = useCallback(() => router.replace('/login'), [router]);

  useEffect(() => {
    if (!application) return;
    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') goLogin();
    });
    void initialData(application)
      .then((data) => {
        if (!active) return;
        if (!data) return goLogin();
        setContext(data.context);
        setLocations(data.locations);
        setList(data.list);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : 'No fue posible abrir Inventario.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, goLogin]);

  const loadList = useCallback(
    async (page = 1) => {
      if (!application) return;
      setLoading(true);
      setMessage(null);
      try {
        setList(
          await application.inventory.list({
            search,
            locationId: locationId || undefined,
            page,
            pageSize: 25,
          }),
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible consultar Inventario.');
      } finally {
        setLoading(false);
      }
    },
    [application, locationId, search],
  );

  const openDetail = useCallback(
    async (materialId: string, variantId?: string) => {
      if (!application) return;
      setBusy(true);
      setMessage(null);
      try {
        setDetail(await application.inventory.materialDetail({ materialId, variantId, pageSize: 25 }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible abrir el material.');
      } finally {
        setBusy(false);
      }
    },
    [application],
  );

  const reloadDetail = useCallback(async () => {
    const material = detail?.material;
    if (!application || !material) return;
    setDetail(
      await application.inventory.materialDetail({
        materialId: material.id,
        variantId: material.variant?.id,
        pageSize: 25,
      }),
    );
  }, [application, detail?.material]);

  async function mutate(operation: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    setNotice(null);
    try {
      await operation();
      await Promise.all([loadList(list?.pagination.page ?? 1), reloadDetail()]);
      setNotice(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible actualizar Inventario.');
    } finally {
      setBusy(false);
    }
  }

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

  return {
    context,
    locations,
    list,
    detail,
    search,
    locationId,
    loading: application ? loading : false,
    busy,
    message: application ? message : 'Este entorno no tiene un backend de staging configurado.',
    notice,
    setSearch,
    setLocationId,
    searchNow: () => loadList(1),
    goPage: loadList,
    openDetail,
    closeDetail: () => setDetail(null),
    receive,
    reserve,
    adjust: (balanceId: string, delta: number, reason: string) =>
      application
        ? mutate(
            () => application.inventory.adjust(balanceId, delta, reason, crypto.randomUUID()),
            'Ajuste aplicado y auditado.',
          )
        : Promise.resolve(),
    submitCount: (balanceId: string, countedQuantity: number, note: string) =>
      application
        ? mutate(
            () =>
              application.inventory.submitCount(
                balanceId,
                countedQuantity,
                note,
                crypto.randomUUID(),
              ),
            'Conteo enviado para revisión.',
          )
        : Promise.resolve(),
    signOut: async () => {
      await application?.auth.signOut();
      goLogin();
    },
  };
}
