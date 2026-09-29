'use client';

import { useState } from 'react';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightPredictionResult } from '@/modules/freight/application/freight-prediction.schemas';
import type {
  LogisticsCandidates,
  LogisticsDetail,
  LogisticsQueue,
} from '@/modules/logistics/application/logistics.schemas';
import type { LogisticsQueueQuery } from '@/modules/logistics/ports/logistics-ports';

const initialQuery: LogisticsQueueQuery = { page: 1, pageSize: 25 };

export function useLogisticsPageState() {
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

  return {
    context, setContext, candidates, setCandidates, queue, setQueue,
    catalog, setCatalog, detail, setDetail, prediction, setPrediction,
    query, setQuery, candidateSearch, setCandidateSearch,
    busy, setBusy, message, setMessage, notice, setNotice,
  };
}
