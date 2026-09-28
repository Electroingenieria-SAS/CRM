'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  FinanceQueue,
  FinanceQueueItem,
  OrderFinancialSummary,
} from '@/modules/finance/application/finance.schemas';
import type {
  FinanceDomain,
  QueueQuery,
} from '@/modules/finance/ports/finance-repository';
import { useFinanceSession } from '@/app/finance/use-finance-session';
import { createFinanceQueueActions } from './finance-queue-actions';

const initialQuery: QueueQuery = { page: 1, pageSize: 25 };

export function useFinanceQueuePage(domain: FinanceDomain) {
  const session = useFinanceSession();
  const [queue, setQueue] = useState<FinanceQueue | null>(null);
  const [query, setQuery] = useState<QueueQuery>(initialQuery);
  const [selected, setSelected] = useState<FinanceQueueItem | null>(null);
  const [summary, setSummary] = useState<OrderFinancialSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (next: QueueQuery) => {
    if (!session.application) return;
    setBusy(true);
    setMessage(null);
    try {
      setQueue(await session.application.finance.listQueue(domain, next));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible consultar la cola.');
    } finally {
      setBusy(false);
    }
  }, [domain, session.application]);

  const select = useCallback(async (orderId: string) => {
    if (!session.application) return;
    setBusy(true);
    try {
      const detail = await session.application.finance.orderSummary(orderId);
      setSummary(detail);
      setSelected((current) => current?.orderId === orderId ? current : null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible consultar el pedido.');
    } finally {
      setBusy(false);
    }
  }, [session.application]);

  useEffect(() => {
    if (session.context) void load(initialQuery);
  }, [session.context, load]);

  function choose(item: FinanceQueueItem) {
    setSelected(item);
    void select(item.orderId);
  }

  function search(next: QueueQuery) {
    const resolved = { ...next, page: 1 };
    setQuery(resolved);
    void load(resolved);
  }

  const actions = useMemo(() => {
    if (!session.application) return null;
    return createFinanceQueueActions(session.application, domain, {
      selected,
      refresh: () => load(query),
      select,
      notice: setNotice,
      error: setMessage,
    });
  }, [domain, load, query, select, selected, session.application]);

  return {
    ...session,
    queue,
    query,
    selected,
    summary,
    busy,
    message: message ?? session.sessionError,
    notice,
    setQuery,
    search,
    choose,
    actions,
  };
}
