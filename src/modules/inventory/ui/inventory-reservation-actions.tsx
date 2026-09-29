'use client';

import { useState } from 'react';
import styles from './inventory-reservation-actions.module.css';

interface Props {
  reservationId: string;
  status: string;
  busy: boolean;
  onRelease(reservationId: string, reason: string): Promise<void>;
  onPick(reservationId: string): Promise<void>;
  onConsume(reservationId: string, reason: string): Promise<void>;
  onReturn(reservationId: string, reason: string): Promise<void>;
  onWaste(reservationId: string, reason: string): Promise<void>;
}

export function InventoryReservationActions(props: Props) {
  const [reason, setReason] = useState('');
  const hasReserved = props.status === 'ACTIVE' || props.status === 'PARTIALLY_PICKED';
  const hasCommitted = props.status === 'PICKED' || props.status === 'PARTIALLY_PICKED';

  if (!hasReserved && !hasCommitted) return null;

  return (
    <div className={styles.reservationActions}>
      {hasCommitted ? (
        <label>
          Motivo / resultado
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej. consumo de corte, sobrante reutilizable"
          />
        </label>
      ) : null}
      <div>
        {hasReserved ? (
          <>
            <button
              type="button"
              disabled={props.busy}
              onClick={() => void props.onPick(props.reservationId)}
            >
              Pasar a picking
            </button>
            <button
              type="button"
              disabled={props.busy}
              onClick={() => void props.onRelease(props.reservationId, reason)}
            >
              Liberar pendiente
            </button>
          </>
        ) : null}
        {hasCommitted ? (
          <>
            <button
              type="button"
              disabled={props.busy}
              onClick={() =>
                void props.onConsume(props.reservationId, reason || 'Consumo operativo')
              }
            >
              Consumir
            </button>
            <button
              type="button"
              disabled={props.busy || !reason.trim()}
              onClick={() => void props.onReturn(props.reservationId, reason)}
            >
              Devolver reutilizable
            </button>
            <button
              type="button"
              disabled={props.busy || !reason.trim()}
              onClick={() => void props.onWaste(props.reservationId, reason)}
            >
              Registrar desperdicio
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
