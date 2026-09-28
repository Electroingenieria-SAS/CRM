'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BrowserApplication } from '@/composition/browser-application';
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

function creditActions(input: {
  application: BrowserApplication | null;
  query: QueueQuery;
  load(next: QueueQuery): Promise<void>;
  setBusy(value: boolean): void;
  setMessage(value: string | null): void;
  setNotice(value: string | null): void;
  setCustomers(value: FinanceCustomerSearch['items']): void;
}) {
  return {
    searchCustomers: async (search: string) => {
      if (!input.application) return;
      input.setBusy(true);
      try {
        const result = await input.application.finance.searchCustomers(search);
        input.setCustomers(result.items);
      } finally {
        input.setBusy(false);
      }
    },
    create: async (value: CreditRequestInput) => {
      if (!input.application) return;
      input.setBusy(true);
      input.setMessage(null);
      try {
        await input.application.finance.createCredit(value, financeKey('credit-create'));
        input.setNotice('Solicitud de crédito radicada.');
        await input.load(input.query);
      } catch (error) {
        input.setMessage(
          error instanceof Error ? error.message : 'No fue posible radicar crédito.',
        );
      } finally {
        input.setBusy(false);
      }
    },
    take: async (requestId: string) => {
      if (!input.application) return;
      input.setBusy(true);
      try {
        await input.application.finance.takeCredit(requestId, financeKey('credit-take'));
        input.setNotice('Solicitud asignada para revisión.');
        await input.load(input.query);
      } finally {
        input.setBusy(false);
      }
    },
    decide: async (requestId: string, decision: 'APPROVED' | 'REJECTED', reason: string) => {
      if (!input.application) return;
      input.setBusy(true);
      try {
        await input.application.finance.decideCredit(
          requestId,
          decision,
          reason,
          financeKey('credit-decision'),
        );
        input.setNotice(decision === 'APPROVED' ? 'Crédito aprobado.' : 'Crédito rechazado.');
        await input.load(input.query);
      } finally {
        input.setBusy(false);
      }
    },
  };
}

export function useCreditPage() {
  const session = useFinanceSession();
  const [queue, setQueue] = useState<CreditQueue | null>(null);
  const [customers, setCustomers] = useState<FinanceCustomerSearch['items']>([]);
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
        setQueue(await session.application.finance.listCredit(next));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible consultar crédito.');
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

  const actions = creditActions({
    application: session.application,
    query,
    load,
    setBusy,
    setMessage,
    setNotice,
    setCustomers,
  });

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
    ...actions,
  };
}
