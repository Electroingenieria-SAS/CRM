'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createLogisticsBrowserApplication,
  type LogisticsBrowserApplication,
} from '@/composition/logistics-browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightPredictionResult } from '@/modules/freight/application/freight-prediction.schemas';
import type {
  LogisticsCandidates,
  LogisticsDetail,
  LogisticsQueue,
} from '@/modules/logistics/application/logistics.schemas';
import type {
  LogisticsQueueQuery,
  LogisticsReleaseInput,
} from '@/modules/logistics/ports/logistics-ports';

const initialQuery: LogisticsQueueQuery = { page: 1, pageSize: 25 };

async function bootstrap(application: LogisticsBrowserApplication) {
  const context = await application.auth.restoreContext();
  if (!context) return null;
  const [candidates, queue, catalog] = await Promise.all([
    application.logistics.candidates(undefined, 1, 25),
    application.logistics.list(initialQuery),
    application.freight.getCatalog(),
  ]);
  return { context, candidates, queue, catalog };
}

export function useLogisticsPage() {
  const router = useRouter();
  const application = useMemo(() => createLogisticsBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [candidates, setCandidates] = useState<LogisticsCandidates | null>(null);
  const [queue, setQueue] = useState<LogisticsQueue | null>(null);
  const [catalog, setCatalog] = useState<FreightCatalog | null>(null);
  const [detail, setDetail] = useState<LogisticsDetail | null>(null);
  const [prediction, setPrediction] = useState<FreightPredictionResult | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!application) return;
    const [nextCandidates, nextQueue] = await Promise.all([
      application.logistics.candidates(candidateSearch, 1, 25),
      application.logistics.list(query),
    ]);
    setCandidates(nextCandidates);
    setQueue(nextQueue);
    if (detail) {
      setDetail(await application.logistics.detail(detail.order.id));
    }
  }, [application, candidateSearch, query, detail]);

  const execute = useCallback(
    async (operation: () => Promise<unknown>, success: string) => {
      setBusy(true);
      setMessage(null);
      setNotice(null);
      try {
        await operation();
        setNotice(success);
        await refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible completar la operación.');
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (!application) return;
    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') router.replace('/login');
    });

    void bootstrap(application)
      .then((workspace) => {
        if (!active) return;
        if (!workspace) return router.replace('/login');
        setContext(workspace.context);
        setCandidates(workspace.candidates);
        setQueue(workspace.queue);
        setCatalog(workspace.catalog);
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'No fue posible abrir Logística.');
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, router]);

  const loadQueue = useCallback(
    async (next: LogisticsQueueQuery) => {
      if (!application) return;
      setBusy(true);
      setMessage(null);
      try {
        const normalized = { ...next, page: 1, pageSize: 25 };
        setQuery(normalized);
        setQueue(await application.logistics.list(normalized));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible filtrar logística.');
      } finally {
        setBusy(false);
      }
    },
    [application],
  );

  const openDetail = useCallback(
    async (orderId: string) => {
      if (!application) return;
      setBusy(true);
      setMessage(null);
      try {
        setDetail(await application.logistics.detail(orderId));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible abrir el despacho.');
      } finally {
        setBusy(false);
      }
    },
    [application],
  );

  return {
    context,
    candidates,
    queue,
    catalog,
    detail,
    prediction,
    query,
    candidateSearch,
    busy: application ? busy : false,
    message: application ? message : 'Este entorno no tiene un backend de staging configurado.',
    notice,
    setQuery,
    setCandidateSearch,
    clearDetail: () => setDetail(null),
    searchCandidates: () =>
      execute(async () => {
        setCandidates(await application!.logistics.candidates(candidateSearch, 1, 25));
      }, 'Candidatos actualizados.'),
    searchQueue: () => loadQueue(query),
    openDetail,
    estimate: async (
      orderId: string,
      routeCode: 'LOCAL_DISPATCH' | 'NATIONAL_DISPATCH',
      destinationId: string,
      carrierId?: string,
    ) => {
      if (!application) return;
      setBusy(true);
      setMessage(null);
      try {
        const response = await application.freight.predict({
          orderId,
          routeCode,
          destinationId,
          carrierId: carrierId || undefined,
        });
        setPrediction(response.results[0] ?? null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible estimar el flete.');
      } finally {
        setBusy(false);
      }
    },
    release: (orderId: string, input: LogisticsReleaseInput) =>
      execute(
        () => application!.logistics.release(orderId, input, crypto.randomUUID()),
        'Pedido liberado a logística.',
      ),
    saveGuide: (shipmentId: string, carrierId: string, tracking: string) =>
      execute(
        () => application!.logistics.saveGuide(shipmentId, carrierId, tracking, crypto.randomUUID()),
        'Guía registrada.',
      ),
    dispatch: (
      shipmentId: string,
      orderId: string,
      version: number,
      actualFreight?: number,
    ) =>
      execute(
        () =>
          application!.logistics.dispatch(
            shipmentId,
            orderId,
            version,
            actualFreight,
            crypto.randomUUID(),
          ),
        'Despacho registrado.',
      ),
    setActualCost: (shipmentId: string, version: number, cost: number) =>
      execute(
        () =>
          application!.logistics.setActualCost(
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
      execute(async () => {
        const evidenceId = await application!.logistics.uploadEvidence(
          context!.organization.id,
          orderId,
          'DELIVERY_PHOTO',
          file,
          crypto.randomUUID(),
        );
        if (!evidenceId) throw new Error('No se pudo registrar la evidencia de entrega.');
        await application!.logistics.deliver(
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
    ) =>
      execute(
        () =>
          application!.logistics.failDelivery(
            shipmentId,
            orderId,
            reason,
            observation,
            undefined,
            version,
            crypto.randomUUID(),
          ),
        'Intento de entrega fallido registrado.',
      ),
    reprogram: (shipmentId: string, version: number) =>
      execute(
        () => application!.logistics.reprogram(shipmentId, version, crypto.randomUUID()),
        'Entrega reprogramada.',
      ),
    returnWithFile: (
      shipmentId: string,
      orderId: string,
      version: number,
      reason: string,
      file: File,
    ) =>
      execute(async () => {
        const evidenceId = await application!.logistics.uploadEvidence(
          context!.organization.id,
          orderId,
          'RETURN',
          file,
          crypto.randomUUID(),
        );
        if (!evidenceId) throw new Error('No se pudo registrar la evidencia de devolución.');
        await application!.logistics.returnShipment(
          shipmentId,
          orderId,
          reason,
          evidenceId,
          version,
          crypto.randomUUID(),
        );
      }, 'Devolución registrada.'),
    satisfaction: (shipmentId: string, rating: number, comment?: string) =>
      execute(
        () =>
          application!.logistics.satisfaction(
            shipmentId,
            rating,
            comment,
            crypto.randomUUID(),
          ),
        'Satisfacción registrada.',
      ),
    signOut: async () => {
      await application?.auth.signOut();
      router.replace('/login');
    },
  };
}
