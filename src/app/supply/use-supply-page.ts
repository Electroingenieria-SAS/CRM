'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSupplyBrowserApplication,
  type SupplyBrowserApplication,
} from '@/composition/supply-browser-application';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import {
  supplyAreaSchema,
  type SupplyArea,
  type SupplyQueue,
} from '@/modules/supply/application/supply.schemas';

const moduleByArea: Record<SupplyArea, string> = {
  PURCHASING: 'purchasing',
  RECEIVING: 'receiving',
  PICKING: 'picking',
  CUTTING: 'cutting',
};

function allowedAreas(context: SessionContext) {
  return supplyAreaSchema.options.filter((area) =>
    hasModuleCapability(context, moduleByArea[area], 'read'),
  );
}

async function bootstrap(application: SupplyBrowserApplication) {
  const context = await application.auth.restoreContext();
  if (!context) return null;
  const areas = allowedAreas(context);
  if (!areas.length) throw new Error('No tienes permisos para consultar la operación de materiales.');
  const area = areas[0];
  return { context, areas, area, queue: await application.supply.queue(area) };
}

export function useSupplyPage() {
  const router = useRouter();
  const application = useMemo(() => createSupplyBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [areas, setAreas] = useState<SupplyArea[]>([]);
  const [area, setAreaState] = useState<SupplyArea>('PURCHASING');
  const [queue, setQueue] = useState<SupplyQueue | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(Boolean(application));
  const [message, setMessage] = useState<string | null>(null);
  const goLogin = useCallback(() => router.replace('/login'), [router]);

  useEffect(() => {
    if (!application) return;
    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') goLogin();
    });
    void bootstrap(application)
      .then((data) => {
        if (!active) return;
        if (!data) return goLogin();
        setContext(data.context);
        setAreas(data.areas);
        setAreaState(data.area);
        setQueue(data.queue);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : 'No fue posible abrir el módulo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, goLogin]);

  const load = useCallback(
    async (nextArea: SupplyArea = area, page = 1) => {
      if (!application) return;
      setLoading(true);
      setMessage(null);
      try {
        setQueue(
          await application.supply.queue(
            nextArea,
            status || undefined,
            search || undefined,
            page,
            25,
          ),
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible consultar la cola.');
      } finally {
        setLoading(false);
      }
    },
    [application, area, search, status],
  );

  const setArea = useCallback(
    (nextArea: SupplyArea) => {
      setAreaState(nextArea);
      setStatus('');
      setSearch('');
      void load(nextArea, 1);
    },
    [load],
  );

  return {
    context,
    areas,
    area,
    queue,
    status,
    search,
    loading: application ? loading : false,
    message: application ? message : 'Este entorno no tiene un backend de staging configurado.',
    setArea,
    setStatus,
    setSearch,
    searchNow: () => load(area, 1),
    goPage: (page: number) => load(area, page),
    signOut: async () => {
      await application?.auth.signOut();
      goLogin();
    },
  };
}
