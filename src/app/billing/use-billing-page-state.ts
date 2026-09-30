'use client';

import { useState } from 'react';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { BillingQueue, BillingQueueItem } from '@/modules/billing/application/billing.schemas';

export function useBillingPageState() {
  const [context, setContext] = useState<SessionContext | null>(null);
  const [queue, setQueue] = useState<BillingQueue | null>(null);
  const [selected, setSelected] = useState<BillingQueueItem | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return {
    context,
    setContext,
    queue,
    setQueue,
    selected,
    setSelected,
    search,
    setSearch,
    busy,
    setBusy,
    message,
    setMessage,
    notice,
    setNotice,
  };
}
