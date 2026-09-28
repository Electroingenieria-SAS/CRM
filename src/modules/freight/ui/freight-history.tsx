import type {
  FreightCarrier,
  FreightDestination,
} from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightHistoryResponse } from '@/modules/freight/application/freight-history.schemas';
import type { FreightHistoryQuery } from '@/modules/freight/application/freight-repository';
import styles from './freight-ui.module.css';

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

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
  const { history, filters } = props;
  const departments = Array.from(
    new Map(
      props.destinations.map((destination) => [
        destination.departmentKey,
        { key: destination.departmentKey, name: destination.department },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return (
    <section className={styles.section} aria-labelledby="freight-history-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="freight-history-title">Histórico relevante</h2>
          <p>Agregados sanitizados y costos reales nuevos, nunca miles de filas en una sola carga.</p>
        </div>
        <span className={styles.meta}>{history.pagination.totalItems} rutas históricas</span>
      </div>

      <form
        className={styles.historyFilters}
        onSubmit={(event) => {
          event.preventDefault();
          props.onSearch();
        }}
      >
        <div className={styles.field}>
          <label htmlFor="history-destination">Destino</label>
          <select
            id="history-destination"
            value={filters.destinationId ?? ''}
            onChange={(event) =>
              props.onFiltersChange({ ...filters, destinationId: event.target.value || undefined })
            }
          >
            <option value="">Todos</option>
            {props.destinations.map((destination) => (
              <option value={destination.id} key={destination.id}>
                {destination.city} — {destination.department}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="history-department">Departamento</label>
          <select
            id="history-department"
            value={filters.departmentKey ?? ''}
            onChange={(event) =>
              props.onFiltersChange({ ...filters, departmentKey: event.target.value || undefined })
            }
          >
            <option value="">Todos</option>
            {departments.map((department) => (
              <option value={department.key} key={department.key}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="history-carrier">Transportadora</label>
          <select
            id="history-carrier"
            value={filters.carrierId ?? ''}
            onChange={(event) =>
              props.onFiltersChange({ ...filters, carrierId: event.target.value || undefined })
            }
          >
            <option value="">Todas</option>
            {props.carriers.map((carrier) => (
              <option value={carrier.id} key={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="history-route">Modalidad</label>
          <select
            id="history-route"
            value={filters.routeCode ?? ''}
            onChange={(event) =>
              props.onFiltersChange({ ...filters, routeCode: event.target.value || undefined })
            }
          >
            <option value="">Todas</option>
            <option value="NATIONAL_DISPATCH">Despacho nacional</option>
            <option value="LOCAL_DISPATCH">Despacho local</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="history-from">Desde</label>
          <input
            id="history-from"
            type="date"
            value={filters.from ?? ''}
            onChange={(event) =>
              props.onFiltersChange({ ...filters, from: event.target.value || undefined })
            }
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="history-to">Hasta</label>
          <input
            id="history-to"
            type="date"
            value={filters.to ?? ''}
            onChange={(event) =>
              props.onFiltersChange({ ...filters, to: event.target.value || undefined })
            }
          />
        </div>
        <div className={styles.actions}>
          <button className="primary-button" type="submit">
            Filtrar histórico
          </button>
        </div>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Destino</th>
              <th>Transportadora</th>
              <th>Muestras</th>
              <th>P20</th>
              <th>Mediana</th>
              <th>P80</th>
              <th>Período</th>
            </tr>
          </thead>
          <tbody>
            {history.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.city} · {row.department}</td>
                <td>{row.carrierName}</td>
                <td>{row.sampleCount}</td>
                <td>{money.format(row.costP20)}</td>
                <td>{money.format(row.costP50)}</td>
                <td>{money.format(row.costP80)}</td>
                <td>{row.sourceFrom} → {row.sourceTo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!history.rows.length ? <div className={styles.empty}>No hay registros para estos filtros.</div> : null}

      <div className={styles.actions}>
        <button
          type="button"
          disabled={history.pagination.page <= 1}
          onClick={() => props.onPage(history.pagination.page - 1)}
        >
          Anterior
        </button>
        <span className={styles.meta}>
          Página {history.pagination.page} de {Math.max(history.pagination.totalPages, 1)}
        </span>
        <button
          type="button"
          disabled={history.pagination.page >= history.pagination.totalPages}
          onClick={() => props.onPage(history.pagination.page + 1)}
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
