'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  CreditQueue,
  FinanceCustomerSearch,
  CreditRequestInput,
} from '@/modules/finance/application/finance.schemas';
import type { QueueQuery } from '@/modules/finance/ports/finance-repository';
import { useFinanceSession } from '@/app/finance/use-finance-session';

const initialQuery: QueueQuery = { page: 1, pageSize: 25 };

function financeKey(prefix: string) {
  return prefix + ':' + crypto.randomUUID();
}

export function useCreditPage() {
  const session = useFinanceSession();
  const [queue, setQueue] = useState<CreditQueue | null>(null);
  const [customers, setCustomers] = useState<FinanceCustomerSearch['items']>([]);
  const [query, setQuery] = useState<QueueQuery>(initialQuery);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (next: QueueQuery) => {
    if (!session.application) return;
    setBusy(true);
    setMessage(null);
    try {
      setQueue(await session.application.finance.listCredit(next));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible consultar crédito.');
    } finally {
      setBusy(false);
    }
  }, [session.application]);

  useEffect(() => {
    if (session.context) void load(initialQuery);
  }, [session.context, load]);

  async function searchCustomers(search: string) {
    if (!session.application) return;
    setBusy(true);
    try {
      const result = await session.application.finance.searchCustomers(search);
      setCustomers(result.items);
    } finally {
      setBusy(false);
    }
  }

  async function create(input: CreditRequestInput) {
    if (!session.application) return;
    setBusy(true);
    setMessage(null);
    try {
      await session.application.finance.createCredit(input, financeKey('credit-create'));
      setNotice('Solicitud de crédito radicada.');
      await load(query);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible radicar crédito.');
    } finally {
      setBusy(false);
    }
  }

  async function take(requestId: string) {
    if (!session.application) return;
    setBusy(true);
    try {
      await session.application.finance.takeCredit(requestId, financeKey('credit-take'));
      setNotice('Solicitud asignada para revisión.');
      await load(query);
    } finally {
      setBusy(false);
    }
  }

  async function decide(
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
  ) {
    if (!session.application) return;
    setBusy(true);
    try {
      await session.application.finance.decideCredit(
        requestId,
        decision,
        reason,
        financeKey('credit-decision'),
      );
      setNotice(decision === 'APPROVED' ? 'Crédito aprobado.' : 'Crédito rechazado.');
      await load(query);
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
    customers,
    query,
    busy,
    message: message ?? session.sessionError,
    notice,
    setQuery,
    search,
    searchCustomers,
    create,
    take,
    decide,
  };
}
