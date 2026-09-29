import type { InventoryMaterialDetail } from '@/modules/inventory/application/inventory.schemas';
import { InventoryReservationActions } from './inventory-reservation-actions';
import styles from './inventory-ui.module.css';

export function InventoryLocationsSection(props: {
  detail: InventoryMaterialDetail;
}) {
  return (
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
            <b>Disponible {balance.available} {props.detail.material.unit}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

export function InventoryReservationsSection(props: {
  detail: InventoryMaterialDetail;
  busy: boolean;
  canUpdate: boolean;
  onRelease(reservationId: string, reason: string): Promise<void>;
  onPick(reservationId: string): Promise<void>;
  onConsume(reservationId: string, reason: string): Promise<void>;
  onReturn(reservationId: string, reason: string): Promise<void>;
  onWaste(reservationId: string, reason: string): Promise<void>;
}) {
  return (
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
  );
}

export function InventoryMovementsSection(props: {
  detail: InventoryMaterialDetail;
}) {
  return (
    <section>
      <h3>Movimientos</h3>
      {props.detail.movements.length ? (
        <div className={styles.movementList}>
          {props.detail.movements.map((movement) => (
            <article key={movement.id}>
              <header>
                <strong>{movement.type}</strong>
                <time dateTime={movement.createdAt}>
                  {new Date(movement.createdAt).toLocaleString('es-CO')}
                </time>
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
  );
}
