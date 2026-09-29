'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLogisticsBrowserApplication } from '@/composition/logistics-browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightPredictionResult } from '@/modules/freight/application/freight-prediction.schemas';
import type {
  LogisticsCandidates,
  LogisticsDetail,
  LogisticsQueue,
} from '@/modules/logistics/application/logistics.schemas';
import type { LogisticsQueueQuery } from '@/modules/logistics/ports/logistics-ports';
import { createLogisticsPageActions } from './logistics-page-actions';
import { useLogisticsBootstrap } from './use-logistics-bootstrap';
import { useLogisticsLoaders } from './use-logistics-loaders';

const initialQuery: LogisticsQueueQuery = { page: 1, pageSize: 25 };

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

  useLogisticsBootstrap(application, router, {
    setContext,
    setCandidates,
    setQueue,
    setCatalog,
    setBusy,
    setMessage,
  });

  const loaders = useLogisticsLoaders({
    application,
    candidateSearch,
    query,
    detail,
    setCandidates,
    setQueue,
    setDetail,
    setQuery,
    setBusy,
    setMessage,
    setNotice,
  });

  const actions = createLogisticsPageActions({
    application,
    context,
    candidateSearch,
    query,
    execute: loaders.execute,
    loadQueue: loaders.loadQueue,
    setCandidates,
    setPrediction,
    setBusy,
    setMessage,
    goToLogin: () => router.replace('/login'),
  });

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
    openDetail: loaders.openDetail,
    ...actions,
  };
}
