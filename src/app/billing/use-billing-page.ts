'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBillingBrowserApplication } from '@/composition/billing-browser-application';
import { createBillingPageActions } from './billing-page-actions';
import { useBillingBootstrap } from './use-billing-bootstrap';
import { useBillingLoader } from './use-billing-loader';
import { useBillingPageState } from './use-billing-page-state';

export function useBillingPage() {
  const router = useRouter();
  const application = useMemo(() => createBillingBrowserApplication(), []);
  const state = useBillingPageState();
  const load = useBillingLoader({
    application,
    search: state.search,
    setBusy: state.setBusy,
    setMessage: state.setMessage,
    setQueue: state.setQueue,
    setSelected: state.setSelected,
  });

  useBillingBootstrap(application, router, {
    setContext: state.setContext,
    setQueue: state.setQueue,
    setBusy: state.setBusy,
    setMessage: state.setMessage,
  });

  const actions = createBillingPageActions({
    application,
    context: state.context,
    search: state.search,
    load,
    setBusy: state.setBusy,
    setMessage: state.setMessage,
    setNotice: state.setNotice,
    goToLogin: () => router.replace('/login'),
  });

  return {
    context: state.context,
    queue: state.queue,
    selected: state.selected,
    search: state.search,
    busy: application ? state.busy : false,
    message: application
      ? state.message
      : 'Este entorno no tiene un backend de staging configurado.',
    notice: state.notice,
    setSelected: state.setSelected,
    setSearch: state.setSearch,
    ...actions,
  };
}
