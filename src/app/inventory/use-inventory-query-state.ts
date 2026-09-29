'use client';

import { useCallback, useEffect, useState } from 'react';
import type { InventoryBrowserApplication } from '@/composition/inventory-browser-application';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  InventoryList,
  InventoryLocation,
  InventoryMaterialDetail,
} from '@/modules/inventory/application/inventory.schemas';

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

export function useInventoryQueryState(
  application: InventoryBrowserApplication | null,
  goLogin: () => void,
) {
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
        if (active) {
          setMessage(
            error instanceof Error ? error.message : 'No fue posible abrir Inventario.',
          );
        }
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
        setMessage(
          error instanceof Error ? error.message : 'No fue posible consultar Inventario.',
        );
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
        setDetail(
          await application.inventory.materialDetail({
            materialId,
            variantId,
            pageSize: 25,
          }),
        );
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'No fue posible abrir el material.',
        );
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

  return {
    context,
    locations,
    list,
    detail,
    search,
    locationId,
    loading,
    busy,
    message,
    notice,
    setSearch,
    setLocationId,
    setDetail,
    setBusy,
    setMessage,
    setNotice,
    loadList,
    openDetail,
    reloadDetail,
  };
}
