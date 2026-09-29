'use client';

import { useState } from 'react';
import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightPredictionResult } from '@/modules/freight/application/freight-prediction.schemas';
import type { LogisticsCandidates } from '@/modules/logistics/application/logistics.schemas';
import type { LogisticsReleaseInput } from '@/modules/logistics/ports/logistics-ports';
import { LogisticsReleasePanel } from '@/modules/logistics/ui/logistics-release-panel';
import { LogisticsCandidateList } from './logistics-workspace-sections';
import styles from '@/modules/logistics/ui/logistics-ui.module.css';

interface ReleaseSectionProps {
  candidates: LogisticsCandidates;
  catalog: FreightCatalog;
  prediction: FreightPredictionResult | null;
  candidateSearch: string;
  busy: boolean;
  canRelease: boolean;
  onCandidateSearch(value: string): void;
  onSearchCandidates(): void;
  onEstimate(
    orderId: string,
    routeCode: 'LOCAL_DISPATCH' | 'NATIONAL_DISPATCH',
    destinationId: string,
    carrierId?: string,
  ): Promise<void>;
  onRelease(orderId: string, input: LogisticsReleaseInput): Promise<void>;
}

export function LogisticsReleaseSection(props: ReleaseSectionProps) {
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const candidate = props.candidates.items.find((item) => item.orderId === candidateId) ?? null;

  return (
    <section className={styles.section} aria-labelledby="release-queue-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="release-queue-title">Por liberar</h2>
          <p>Facturación y Finance ya deben estar listos.</p>
        </div>
        <div className={styles.inlineSearch}>
          <input
            aria-label="Buscar candidatos"
            value={props.candidateSearch}
            onChange={(event) => props.onCandidateSearch(event.target.value)}
            placeholder="Pedido o cliente"
          />
          <button type="button" disabled={props.busy} onClick={props.onSearchCandidates}>
            Buscar
          </button>
        </div>
      </div>

      <div className={styles.twoColumns}>
        <LogisticsCandidateList
          items={props.candidates.items}
          selectedId={candidate?.orderId}
          onSelect={(item) => setCandidateId(item.orderId)}
        />
        <LogisticsReleasePanel
          key={candidate?.orderId ?? 'none'}
          candidate={candidate}
          catalog={props.catalog}
          prediction={props.prediction}
          busy={props.busy}
          canRelease={props.canRelease}
          onEstimate={props.onEstimate}
          onRelease={props.onRelease}
        />
      </div>
    </section>
  );
}
