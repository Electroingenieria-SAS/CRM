'use client';

import { useState, type FormEvent } from 'react';
import type {
  InventoryLocation,
  InventoryMaterialDetail,
} from '@/modules/inventory/application/inventory.schemas';
import styles from './inventory-ui.module.css';

interface CommonProps {
  detail: InventoryMaterialDetail;
  locations: readonly InventoryLocation[];
  busy: boolean;
}

export function InventoryReceiptForm(
  props: CommonProps & {
    onReceive(input: {
      locationId: string;
      quantity: number;
      reference?: string;
      reason?: string;
    }): Promise<void>;
  },
) {
  const [locationId, setLocationId] = useState(props.detail.balances[0]?.locationId ?? '');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await props.onReceive({
      locationId,
      quantity: Number(quantity),
      reference: reference.trim() || undefined,
    });
    setQuantity('');
    setReference('');
  }

  return (
    <form className={styles.actionForm} onSubmit={(event) => void submit(event)}>
      <h3>Registrar entrada</h3>
      <label>
        Ubicación
        <select value={locationId} onChange={(event) => setLocationId(event.target.value)} required>
          <option value="">Selecciona</option>
          {props.locations.map((location) => (
            <option value={location.id} key={location.id}>
              {location.code} · {location.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Cantidad ({props.detail.material.unit})
        <input
          type="number"
          min="0.0001"
          step="0.0001"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
      </label>
      <label>
        Referencia de recepción
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          maxLength={120}
        />
      </label>
      <button disabled={props.busy || !locationId} type="submit">
        Registrar entrada
      </button>
    </form>
  );
}

export function InventoryReserveForm(
  props: CommonProps & {
    onReserve(input: {
      orderNumber: string;
      locationId?: string;
      quantity: number;
      reference?: string;
    }): Promise<void>;
  },
) {
  const [orderNumber, setOrderNumber] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await props.onReserve({
      orderNumber: orderNumber.trim(),
      locationId: locationId || undefined,
      quantity: Number(quantity),
      reference: orderNumber.trim(),
    });
    setQuantity('');
  }

  return (
    <form className={styles.actionForm} onSubmit={(event) => void submit(event)}>
      <h3>Reservar para pedido</h3>
      <label>
        Número de pedido
        <input
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value)}
          maxLength={120}
          required
        />
      </label>
      <label>
        Ubicación preferida
        <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
          <option value="">Asignación automática</option>
          {props.detail.balances.map((balance) => (
            <option value={balance.locationId} key={balance.balanceId}>
              {balance.locationCode} · disponible {balance.available}
            </option>
          ))}
        </select>
      </label>
      <label>
        Cantidad ({props.detail.material.unit})
        <input
          type="number"
          min="0.0001"
          step="0.0001"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
      </label>
      <button disabled={props.busy} type="submit">
        Reservar
      </button>
    </form>
  );
}

export function InventoryAdjustmentForm(
  props: CommonProps & {
    onAdjust(balanceId: string, delta: number, reason: string): Promise<void>;
  },
) {
  const [balanceId, setBalanceId] = useState(props.detail.balances[0]?.balanceId ?? '');
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);

  return (
    <form
      className={styles.actionForm}
      onSubmit={(event) => {
        event.preventDefault();
        void props.onAdjust(balanceId, Number(delta), reason).then(() => {
          setDelta('');
          setReason('');
          setConfirm(false);
        });
      }}
    >
      <h3>Ajuste auditado</h3>
      <label>
        Ubicación
        <select value={balanceId} onChange={(event) => setBalanceId(event.target.value)} required>
          {props.detail.balances.map((balance) => (
            <option value={balance.balanceId} key={balance.balanceId}>
              {balance.locationCode} · físico {balance.onHand}
            </option>
          ))}
        </select>
      </label>
      <label>
        Variación (+ / -)
        <input
          type="number"
          step="0.0001"
          value={delta}
          onChange={(event) => setDelta(event.target.value)}
          required
        />
      </label>
      <label>
        Motivo
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          required
        />
      </label>
      <label className={styles.confirm}>
        <input
          type="checkbox"
          checked={confirm}
          onChange={(event) => setConfirm(event.target.checked)}
        />
        Confirmo el impacto esperado sobre el stock físico.
      </label>
      <button type="submit" disabled={props.busy || !confirm}>
        Aplicar ajuste
      </button>
    </form>
  );
}
