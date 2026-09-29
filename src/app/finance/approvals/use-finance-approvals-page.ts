'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FinancialApprovalQueue } from '@/modules/finance/application/finance.schemas';
import type { QueueQuery } from '@/modules/finance/ports/finance-repository';
import { useFinanceSession } from '@/app/finance/use-finance-session';

const initialQuery: QueueQuery = { status: 'PENDING', page: 1, pageSize: 25 };

function key() {
  return 'finance-approval:' + crypto.randomUUID();
}

export function useFinanceApprovalsPage() {
  const session = useFinanceSession();
  const [queue, setQueue] = useState<FinancialApprovalQueue | null>(null);
  const [query, setQuery] = useState<QueueQuery>(initialQuery);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (next: QueueQuery) => {
      if (!session.application) return;
      setBusy(true);
      setMessage(null);
      try {
        setQueue(await session.application.finance.listApprovals(next));
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'No fue posible consultar aprobaciones.',
        );
      } finally {
        setBusy(false);
      }
    },
    [session.application],
  );

  useEffect(() => {
    if (!session.context) return;
    const timer = window.setTimeout(() => void load(initialQuery), 0);
    return () => window.clearTimeout(timer);
  }, [session.context, load]);

  async function decide(id: string, decision: 'APPROVED' | 'REJECTED', reason: string) {
    if (!session.application) return;
    setBusy(true);
    try {
      await session.application.finance.decideException(id, decision, reason, key());
      setNotice(decision === 'APPROVED' ? 'Excepción aprobada.' : 'Excepción rechazada.');
      await load(query);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible registrar la decisión.');
    } finally {
      setBusy(false);
    }
  }

  function search(next: QueueQuery) {
    const resolved = { ...next, page: 1 };
    setQuery(resolved);
    void load(resolved);
  }

  return {
    ...session,
    queue,
    query,
    busy,
    message: message ?? session.sessionError,
    notice,
    setQuery,
    search,
    decide,
  };
}
