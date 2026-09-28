import type {
  FreightCarrier,
  FreightDestination,
} from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightHistoryQuery } from '@/modules/freight/application/freight-repository';
import styles from './freight-ui.module.css';

interface HistoryFiltersProps {
  carriers: readonly FreightCarrier[];
  destinations: readonly FreightDestination[];
  filters: FreightHistoryQuery;
  onChange(filters: FreightHistoryQuery): void;
  onSearch(): void;
}

function departmentsFrom(destinations: readonly FreightDestination[]) {
  return Array.from(
    new Map(
      destinations.map((destination) => [
        destination.departmentKey,
        { key: destination.departmentKey, name: destination.department },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function FreightHistoryScopeFilters(props: HistoryFiltersProps) {
  const departments = departmentsFrom(props.destinations);
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="history-destination">Destino</label>
        <select
          id="history-destination"
          value={props.filters.destinationId ?? ''}
          onChange={(event) =>
            props.onChange({
              ...props.filters,
              destinationId: event.target.value || undefined,
            })
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
          value={props.filters.departmentKey ?? ''}
          onChange={(event) =>
            props.onChange({
              ...props.filters,
              departmentKey: event.target.value || undefined,
            })
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
          value={props.filters.carrierId ?? ''}
          onChange={(event) =>
            props.onChange({
              ...props.filters,
              carrierId: event.target.value || undefined,
            })
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
    </>
  );
}

function FreightHistoryPeriodFilters(props: HistoryFiltersProps) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="history-route">Modalidad</label>
        <select
          id="history-route"
          value={props.filters.routeCode ?? ''}
          onChange={(event) =>
            props.onChange({
              ...props.filters,
              routeCode: event.target.value || undefined,
            })
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
          value={props.filters.from ?? ''}
          onChange={(event) =>
            props.onChange({ ...props.filters, from: event.target.value || undefined })
          }
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="history-to">Hasta</label>
        <input
          id="history-to"
          type="date"
          value={props.filters.to ?? ''}
          onChange={(event) =>
            props.onChange({ ...props.filters, to: event.target.value || undefined })
          }
        />
      </div>
      <div className={styles.actions}>
        <button className="primary-button" type="submit">
          Filtrar histórico
        </button>
      </div>
    </>
  );
}

export function FreightHistoryFilters(props: HistoryFiltersProps) {
  return (
    <form
      className={styles.historyFilters}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSearch();
      }}
    >
      <FreightHistoryScopeFilters {...props} />
      <FreightHistoryPeriodFilters {...props} />
    </form>
  );
}
