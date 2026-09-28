import type { FreightHistoryResponse } from '@/modules/freight/application/freight-history.schemas';
import styles from './freight-ui.module.css';

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function FreightHistoryTable({ history }: { history: FreightHistoryResponse }) {
  if (!history.rows.length) {
    return <div className={styles.empty}>No hay registros para estos filtros.</div>;
  }

  return (
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
              <td>
                {row.city} · {row.department}
              </td>
              <td>{row.carrierName}</td>
              <td>{row.sampleCount}</td>
              <td>{money.format(row.costP20)}</td>
              <td>{money.format(row.costP50)}</td>
              <td>{money.format(row.costP80)}</td>
              <td>
                {row.sourceFrom} → {row.sourceTo}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  history: FreightHistoryResponse;
  onPage(page: number): void;
}

export function FreightHistoryPagination({ history, onPage }: PaginationProps) {
  const { page, totalPages } = history.pagination;
  return (
    <div className={styles.actions}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </button>
      <span className={styles.meta}>
        Página {page} de {Math.max(totalPages, 1)}
      </span>
      <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Siguiente
      </button>
    </div>
  );
}

export function FreightActualsTable({ history }: { history: FreightHistoryResponse }) {
  if (!history.recentActuals.length) return null;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>Costos reales recientes incorporados al aprendizaje</caption>
        <thead>
          <tr>
            <th>Destino</th>
            <th>Transportadora</th>
            <th>Costo real</th>
            <th>Peso</th>
            <th>Modalidad</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {history.recentActuals.map((row) => (
            <tr key={row.id}>
              <td>
                {row.city} · {row.department}
              </td>
              <td>{row.carrierName}</td>
              <td>{money.format(row.actualCost)}</td>
              <td>{row.weightKg == null ? '—' : `${row.weightKg} kg`}</td>
              <td>{row.route}</td>
              <td>{row.observedAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
