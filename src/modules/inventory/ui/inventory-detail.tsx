import type {
  InventoryLocation,
  InventoryMaterialDetail,
} from '@/modules/inventory/application/inventory.schemas';
import {
  InventoryControlForms,
  InventoryReceiptForm,
  InventoryReserveForm,
} from './inventory-forms';
import { InventoryReservationActions } from './inventory-reservation-actions';
import styles from './inventory-ui.module.css';

interface Props {
  detail: InventoryMaterialDetail;
  locations: readonly InventoryLocation[];
  busy: boolean;
  canCreate: boolean;
  canApprove: boolean;
  canUpdate: boolean;
  onClose(): void;
  onReceive(input: { locationId: string; quantity: number; reference?: string; reason?: string }): Promise<void>;
  onReserve(input: { orderNumber: string; locationId?: string; quantity: number; reference?: string }): Promise<void>;
  onRelease(reservationId: string, reason: string): Promise<void>;
  onPick(reservationId: string): Promise<void>;
  onConsume(reservationId: string, reason: string): Promise<void>;
  onReturn(reservationId: string, reason: string): Promise<void>;
  onWaste(reservationId: string, reason: string): Promise<void>;
  onAdjust(balanceId: string, delta: number, reason: string): Promise<void>;
  onCount(balanceId: string, counted: number, note: string): Promise<void>;
}

export function InventoryDetail(props: Props) {
  const material = props.detail.material;
  const total = props.detail.balances.reduce(
    (acc, balance) => ({
      onHand: acc.onHand + balance.onHand,
      reserved: acc.reserved + balance.reserved,
      committed: acc.committed + balance.committed,
      available: acc.available + balance.available,
    }),
    { onHand: 0, reserved: 0, committed: 0, available: 0 },
  );

  return (
    <section className={styles.detail} aria-labelledby="inventory-detail-title">
      <header className={styles.detailHeader}>
        <div>
          <p className="eyebrow">Trazabilidad del material</p>
          <h2 id="inventory-detail-title">{material.reference} · {material.name}</h2>
          {material.variant ? <p>{material.variant.label}</p> : null}
        </div>
        <button type="button" onClick={props.onClose}>Cerrar detalle</button>
      </header>

      <div className={styles.summaryGrid}>
        <Metric label="Físico" value={total.onHand} unit={material.unit} />
        <Metric label="Reservado" value={total.reserved} unit={material.unit} />
        <Metric label="Comprometido" value={total.committed} unit={material.unit} />
        <Metric label="Disponible" value={total.available} unit={material.unit} />
      </div>

      <section>
        <h3>Ubicaciones</h3>
        <div className={styles.locationGrid}>
          {props.detail.balances.map((balance) => (
            <article className={styles.locationCard} key={balance.balanceId}>
              <strong>{balance.locationCode}</strong>
              <span>{balance.locationName}</span>
              <small>
                Físico {balance.onHand} · Reservado {balance.reserved} · Comprometido {balance.committed}
              </small>
              <b>Disponible {balance.available} {material.unit}</b>
            </article>
          ))}
        </div>
      </section>

      {props.canCreate ? (
        <div className={styles.actionGrid}>
          <InventoryReceiptForm
            detail={props.detail}
            locations={props.locations}
            busy={props.busy}
            onReceive={props.onReceive}
          />
          <InventoryReserveForm
            detail={props.detail}
            locations={props.locations}
            busy={props.busy}
            onReserve={props.onReserve}
          />
        </div>
      ) : null}

      <InventoryControlForms
        detail={props.detail}
        locations={props.locations}
        busy={props.busy}
        canApprove={props.canApprove}
        canCount={props.canCreate}
        onAdjust={props.onAdjust}
        onCount={props.onCount}
      />

      <section>
        <h3>Reservas activas</h3>
        {props.detail.reservations.length ? (
          <div className={styles.reservationList}>
            {props.detail.reservations.map((reservation) => (
              <article key={reservation.id}>
                <strong>{reservation.orderNumber}</strong>
                <span>{reservation.quantity} {reservation.unit}</span>
                <span>{reservation.status}</span>
                {props.canUpdate ? (
                  <InventoryReservationActions
                    reservationId={reservation.id}
                    status={reservation.status}
                    busy={props.busy}
                    onRelease={props.onRelease}
                    onPick={props.onPick}
                    onConsume={props.onConsume}
                    onReturn={props.onReturn}
                    onWaste={props.onWaste}
                  />
                ) : null}
              </article>
            ))}
          </div>
        ) : <p className={styles.empty}>Sin reservas activas.</p>}
      </section>

      <section>
        <h3>Movimientos</h3>
        {props.detail.movements.length ? (
          <div className={styles.movementList}>
            {props.detail.movements.map((movement) => (
              <article key={movement.id}>
                <header>
                  <strong>{movement.type}</strong>
                  <time dateTime={movement.createdAt}>{new Date(movement.createdAt).toLocaleString('es-CO')}</time>
                </header>
                <p>{movement.quantity} {movement.unit} · {movement.locationCode}</p>
                <small>
                  Físico {movement.onHandDelta >= 0 ? '+' : ''}{movement.onHandDelta} ·
                  Reservado {movement.reservedDelta >= 0 ? '+' : ''}{movement.reservedDelta} ·
                  Comprometido {movement.committedDelta >= 0 ? '+' : ''}{movement.committedDelta}
                </small>
                <footer>
                  <span>{movement.actor}</span>
                  {movement.orderNumber ? <span>Pedido {movement.orderNumber}</span> : null}
                  {movement.reason ? <span>{movement.reason}</span> : null}
                </footer>
              </article>
            ))}
          </div>
        ) : <p className={styles.empty}>Sin movimientos registrados.</p>}
      </section>
    </section>
  );
}

function Metric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <article className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </article>
  );
}
