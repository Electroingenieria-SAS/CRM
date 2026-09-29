'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createInventoryBrowserApplication } from '@/composition/inventory-browser-application';
import { createInventoryPageActions } from '@/app/inventory/inventory-page-actions';
import { useInventoryQueryState } from '@/app/inventory/use-inventory-query-state';

export function useInventoryPage() {
  const router = useRouter();
  const application = useMemo(() => createInventoryBrowserApplication(), []);
  const goLogin = useCallback(() => router.replace('/login'), [router]);
  const state = useInventoryQueryState(application, goLogin);
  const actions = createInventoryPageActions({
    application,
    detail: state.detail,
    list: state.list,
    loadList: state.loadList,
    reloadDetail: state.reloadDetail,
    setBusy: state.setBusy,
    setMessage: state.setMessage,
    setNotice: state.setNotice,
  });

  return {
    context: state.context,
    locations: state.locations,
    list: state.list,
    detail: state.detail,
    search: state.search,
    locationId: state.locationId,
    loading: application ? state.loading : false,
    busy: state.busy,
    message: application
      ? state.message
      : 'Este entorno no tiene un backend de staging configurado.',
    notice: state.notice,
    setSearch: state.setSearch,
    setLocationId: state.setLocationId,
    searchNow: () => state.loadList(1),
    goPage: state.loadList,
    openDetail: state.openDetail,
    closeDetail: () => state.setDetail(null),
    ...actions,
    signOut: async () => {
      await application?.auth.signOut();
      goLogin();
    },
  };
}
