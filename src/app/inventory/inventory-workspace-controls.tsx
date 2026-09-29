import type { Dispatch, SetStateAction } from 'react';
import type {
  InventoryList,
  InventoryLocation,
} from '@/modules/inventory/application/inventory.schemas';
import styles from '@/modules/inventory/ui/inventory-ui.module.css';

export function InventoryFilters(props: {
  search: string;
  locationId: string;
  locations: InventoryLocation[];
  loading: boolean;
  setSearch: Dispatch<SetStateAction<string>>;
  setLocationId: Dispatch<SetStateAction<string>>;
  searchNow(): Promise<void>;
}) {
  return (
    <form
      className={styles.filters}
      onSubmit={(event) => {
        event.preventDefault();
        void props.searchNow();
      }}
      role="search"
    >
      <label>
        Buscar material
        <input
          value={props.search}
          onChange={(event) => props.setSearch(event.target.value)}
          placeholder="Referencia, material, variante o ubicación"
        />
      </label>
      <label>
        Ubicación
        <select value={props.locationId} onChange={(event) => props.setLocationId(event.target.value)}>
          <option value="">Todas</option>
          {props.locations.map((location) => (
            <option value={location.id} key={location.id}>
              {location.code} · {location.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={props.loading}>Buscar</button>
    </form>
  );
}

export function InventoryFeedback(props: {
  notice: string | null;
  message: string | null;
  loading: boolean;
}) {
  return (
    <>
      {props.notice ? <p className={styles.notice} role="status">{props.notice}</p> : null}
      {props.message ? <p className={styles.error} role="alert">{props.message}</p> : null}
      {props.loading ? <p role="status">Actualizando inventario…</p> : null}
    </>
  );
}

export function InventoryPagination(props: {
  pagination: InventoryList['pagination'];
  goPage(page: number): Promise<void>;
}) {
  const page = props.pagination.page;
  const pages = props.pagination.totalPages;
  return (
    <nav className={styles.pagination} aria-label="Paginación de inventario">
      <button type="button" disabled={page <= 1} onClick={() => void props.goPage(page - 1)}>
        Anterior
      </button>
      <span>Página {page} de {Math.max(pages, 1)}</span>
      <button type="button" disabled={page >= pages} onClick={() => void props.goPage(page + 1)}>
        Siguiente
      </button>
    </nav>
  );
}
