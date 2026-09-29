import type { InventoryList as InventoryListResponse } from '@/modules/inventory/application/inventory.schemas';
import styles from './inventory-ui.module.css';

interface Props {
  data: InventoryListResponse;
  loading: boolean;
  onOpen(materialId: string, variantId?: string): void;
}

function StockValues({
  onHand,
  reserved,
  committed,
  available,
}: {
  onHand: number;
  reserved: number;
  committed: number;
  available: number;
}) {
  return (
    <>
      <span>
        Físico <strong>{onHand}</strong>
      </span>
      <span>
        Reservado <strong>{reserved}</strong>
      </span>
      <span>
        Comprometido <strong>{committed}</strong>
      </span>
      <span>
        Disponible <strong>{available}</strong>
      </span>
    </>
  );
}

export function InventoryList({ data, loading, onOpen }: Props) {
  if (!data.items.length) {
    return <p className={styles.empty}>No hay saldos que coincidan con los filtros.</p>;
  }

  return (
    <section aria-label="Existencias de inventario">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Material</th>
              <th>Ubicación</th>
              <th>Físico</th>
              <th>Reservado</th>
              <th>Comprometido</th>
              <th>Disponible</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.balanceId}>
                <td>
                  <strong>{item.reference}</strong>
                  <span>{item.name}</span>
                  {item.variantLabel ? <small>{item.variantLabel}</small> : null}
                </td>
                <td>
                  {item.locationCode} · {item.locationName}
                </td>
                <td>
                  {item.onHand} {item.unit}
                </td>
                <td>
                  {item.reserved} {item.unit}
                </td>
                <td>
                  {item.committed} {item.unit}
                </td>
                <td>
                  {item.available} {item.unit}
                </td>
                <td>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onOpen(item.materialId, item.variantId ?? undefined)}
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {data.items.map((item) => (
          <article className={styles.card} key={item.balanceId}>
            <header>
              <div>
                <strong>{item.reference}</strong>
                <p>{item.name}</p>
                {item.variantLabel ? <small>{item.variantLabel}</small> : null}
              </div>
              <span>{item.locationCode}</span>
            </header>
            <div className={styles.stockGrid}>
              <StockValues
                onHand={item.onHand}
                reserved={item.reserved}
                committed={item.committed}
                available={item.available}
              />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => onOpen(item.materialId, item.variantId ?? undefined)}
            >
              Ver trazabilidad
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
