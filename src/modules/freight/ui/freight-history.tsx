import type {
  FreightCarrier,
  FreightDestination,
} from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightHistoryResponse } from '@/modules/freight/application/freight-history.schemas';
import type { FreightHistoryQuery } from '@/modules/freight/application/freight-repository';
import { FreightHistoryFilters } from './freight-history-filters';
import {
  FreightActualsTable,
  FreightHistoryPagination,
  FreightHistoryTable,
} from './freight-history-table';
import styles from './freight-ui.module.css';

interface FreightHistoryProps {
  history: FreightHistoryResponse;
  carriers: readonly FreightCarrier[];
  destinations: readonly FreightDestination[];
  filters: FreightHistoryQuery;
  onFiltersChange(filters: FreightHistoryQuery): void;
  onSearch(): void;
  onPage(page: number): void;
}

export function FreightHistory(props: FreightHistoryProps) {
  return (
    <section className={styles.section} aria-labelledby="freight-history-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="freight-history-title">Histórico relevante</h2>
          <p>Agregados sanitizados y costos reales nuevos, nunca miles de filas en una sola carga.</p>
        </div>
        <span className={styles.meta}>{props.history.pagination.totalItems} rutas históricas</span>
      </div>
      <FreightHistoryFilters
        carriers={props.carriers}
        destinations={props.destinations}
        filters={props.filters}
        onChange={props.onFiltersChange}
        onSearch={props.onSearch}
      />
      <FreightHistoryTable history={props.history} />
      <FreightActualsTable history={props.history} />
      <FreightHistoryPagination history={props.history} onPage={props.onPage} />
    </section>
  );
}
