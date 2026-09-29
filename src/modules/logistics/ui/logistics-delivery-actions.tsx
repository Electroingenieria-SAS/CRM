'use client';

import { useState } from 'react';
import type { LogisticsDetail } from '@/modules/logistics/application/logistics.schemas';
import styles from './logistics-ui.module.css';

type Shipment = NonNullable<LogisticsDetail['shipment']>;
type Order = LogisticsDetail['order'];

interface DeliveryActionsProps {
  shipment: Shipment;
  order: Order;
  satisfaction: LogisticsDetail['satisfaction'];
  busy: boolean;
  canUpdate: boolean;
  canSatisfaction: boolean;
  onDeliver(
    shipmentId: string,
    orderId: string,
    version: number,
    file: File,
    receivedBy?: string,
    observation?: string,
  ): Promise<void>;
  onFail(
    shipmentId: string,
    orderId: string,
    version: number,
    reason: string,
    observation?: string,
    file?: File,
  ): Promise<void>;
  onReprogram(shipmentId: string, version: number): Promise<void>;
  onReturn(
    shipmentId: string,
    orderId: string,
    version: number,
    reason: string,
    file: File,
  ): Promise<void>;
  onSatisfaction(shipmentId: string, rating: number, comment?: string): Promise<void>;
}

function DeliveryForm(props: Pick<
  DeliveryActionsProps,
  'shipment' | 'order' | 'busy' | 'canUpdate' | 'onDeliver'
>) {
  const [receivedBy, setReceivedBy] = useState(props.shipment.receivedBy ?? '');
  const [observation, setObservation] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const pickup = props.shipment.routeCode === 'CLIENT_PICKUP';

  return (
    <div className={styles.actionBlock}>
      <h3>Confirmar entrega</h3>
      <label>
        Receptor {pickup ? '*' : ''}
        <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
      </label>
      <label>
        Evidencia *
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <label>
        Observación
        <textarea value={observation} onChange={(e) => setObservation(e.target.value)} />
      </label>
      <button
        type="button"
        className={styles.primary}
        disabled={props.busy || !props.canUpdate || !file || (pickup && !receivedBy.trim())}
        onClick={() =>
          file &&
          void props.onDeliver(
            props.shipment.id,
            props.order.id,
            props.shipment.version,
            file,
            receivedBy,
            observation,
          )
        }
      >
        Confirmar entrega
      </button>
    </div>
  );
}

function FailureForm(props: Pick<
  DeliveryActionsProps,
  'shipment' | 'order' | 'busy' | 'canUpdate' | 'onFail'
>) {
  const [reason, setReason] = useState('');
  const [observation, setObservation] = useState('');
  const [file, setFile] = useState<File | null>(null);

  return (
    <details className={styles.actionBlock}>
      <summary>Registrar no entrega</summary>
      <label>
        Motivo *
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <label>
        Observación
        <textarea value={observation} onChange={(e) => setObservation(e.target.value)} />
      </label>
      <label>
        Evidencia opcional
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button
        type="button"
        disabled={props.busy || !props.canUpdate || !reason.trim()}
        onClick={() =>
          void props.onFail(
            props.shipment.id,
            props.order.id,
            props.shipment.version,
            reason,
            observation,
            file ?? undefined,
          )
        }
      >
        Registrar intento fallido
      </button>
    </details>
  );
}

function ReturnForm(props: Pick<
  DeliveryActionsProps,
  'shipment' | 'order' | 'busy' | 'canUpdate' | 'onReturn'
>) {
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);

  return (
    <details className={styles.actionBlock}>
      <summary>Registrar devolución</summary>
      <label>
        Causa *
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <label>
        Evidencia *
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button
        type="button"
        disabled={props.busy || !props.canUpdate || !reason.trim() || !file}
        onClick={() =>
          file &&
          void props.onReturn(
            props.shipment.id,
            props.order.id,
            props.shipment.version,
            reason,
            file,
          )
        }
      >
        Registrar devolución
      </button>
    </details>
  );
}

function SatisfactionForm(props: Pick<
  DeliveryActionsProps,
  'shipment' | 'busy' | 'onSatisfaction'
>) {
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');

  return (
    <div className={styles.actionBlock}>
      <h3>Satisfacción</h3>
      <label>
        Calificación
        <select value={rating} onChange={(e) => setRating(e.target.value)}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>{value} / 5</option>
          ))}
        </select>
      </label>
      <label>
        Comentario
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <button
        type="button"
        disabled={props.busy}
        onClick={() =>
          void props.onSatisfaction(props.shipment.id, Number(rating), comment)
        }
      >
        Guardar satisfacción
      </button>
    </div>
  );
}

export function LogisticsDeliveryActions(props: DeliveryActionsProps) {
  const dispatchRoute =
    props.shipment.routeCode === 'LOCAL_DISPATCH' ||
    props.shipment.routeCode === 'NATIONAL_DISPATCH';
  const canDeliver =
    (dispatchRoute && props.shipment.status === 'IN_TRANSIT') ||
    (!dispatchRoute && props.shipment.status === 'READY');
  const canReturn =
    props.shipment.status === 'IN_TRANSIT' ||
    props.shipment.status === 'DELIVERY_FAILED';
  const showSatisfaction =
    props.shipment.status === 'DELIVERED' &&
    !props.satisfaction &&
    props.canSatisfaction;

  return (
    <>
      {canDeliver ? <DeliveryForm {...props} /> : null}
      {canDeliver ? <FailureForm {...props} /> : null}
      {props.shipment.status === 'DELIVERY_FAILED' ? (
        <button
          type="button"
          disabled={props.busy || !props.canUpdate}
          onClick={() => void props.onReprogram(props.shipment.id, props.shipment.version)}
        >
          Reprogramar entrega
        </button>
      ) : null}
      {canReturn ? <ReturnForm {...props} /> : null}
      {showSatisfaction ? <SatisfactionForm {...props} /> : null}
    </>
  );
}
