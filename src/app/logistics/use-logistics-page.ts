'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createLogisticsBrowserApplication } from '@/composition/logistics-browser-application';
import { createLogisticsPageActions } from './logistics-page-actions';
import { useLogisticsBootstrap } from './use-logistics-bootstrap';
import { useLogisticsLoaders } from './use-logistics-loaders';
import { useLogisticsPageState } from './use-logistics-page-state';

export function useLogisticsPage() {
  const router = useRouter();
  const application = useMemo(() => createLogisticsBrowserApplication(), []);
  const state = useLogisticsPageState();

  useLogisticsBootstrap(application, router, {
    setContext: state.setContext,
    setCandidates: state.setCandidates,
    setQueue: state.setQueue,
    setCatalog: state.setCatalog,
    setBusy: state.setBusy,
    setMessage: state.setMessage,
  });

  const loaders = useLogisticsLoaders({
    application,
    candidateSearch: state.candidateSearch,
    query: state.query,
    detail: state.detail,
    setCandidates: state.setCandidates,
    setQueue: state.setQueue,
    setDetail: state.setDetail,
    setQuery: state.setQuery,
    setBusy: state.setBusy,
    setMessage: state.setMessage,
    setNotice: state.setNotice,
  });

  const actions = createLogisticsPageActions({
    application,
    context: state.context,
    candidateSearch: state.candidateSearch,
    query: state.query,
    execute: loaders.execute,
    loadQueue: loaders.loadQueue,
    setCandidates: state.setCandidates,
    setPrediction: state.setPrediction,
    setBusy: state.setBusy,
    setMessage: state.setMessage,
    goToLogin: () => router.replace('/login'),
  });

  return {
    context: state.context,
    candidates: state.candidates,
    queue: state.queue,
    catalog: state.catalog,
    detail: state.detail,
    prediction: state.prediction,
    query: state.query,
    candidateSearch: state.candidateSearch,
    busy: application ? state.busy : false,
    message: application
      ? state.message
      : 'Este entorno no tiene un backend de staging configurado.',
    notice: state.notice,
    setQuery: state.setQuery,
    setCandidateSearch: state.setCandidateSearch,
    clearDetail: () => state.setDetail(null),
    openDetail: loaders.openDetail,
    ...actions,
  };
}
