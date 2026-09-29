import type {
  InventoryLocation,
  InventoryMaterialDetail,
} from '@/modules/inventory/application/inventory.schemas';
import {
  InventoryAdjustmentForm,
  InventoryReceiptForm,
  InventoryReserveForm,
} from './inventory-forms';
import {
  InventoryLocationsSection,
  InventoryMovementsSection,
  InventoryReservationsSection,
} from './inventory-detail-sections';
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

      <InventoryLocationsSection detail={props.detail} />

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

      {props.canApprove ? (
        <div className={styles.controlForms}>
          <InventoryAdjustmentForm
            detail={props.detail}
            locations={props.locations}
            busy={props.busy}
            onAdjust={props.onAdjust}
          />
        </div>
      ) : null}

      <InventoryReservationsSection
        detail={props.detail}
        busy={props.busy}
        canUpdate={props.canUpdate}
        onRelease={props.onRelease}
        onPick={props.onPick}
        onConsume={props.onConsume}
        onReturn={props.onReturn}
        onWaste={props.onWaste}
      />
      <InventoryMovementsSection detail={props.detail} />
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
