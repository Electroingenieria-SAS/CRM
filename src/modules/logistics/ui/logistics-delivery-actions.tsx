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

export function LogisticsDeliveryActions(props: DeliveryActionsProps) {
  const [receivedBy, setReceivedBy] = useState(props.shipment.receivedBy ?? '');
  const [observation, setObservation] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [failureFile, setFailureFile] = useState<File | null>(null);
  const [returnFile, setReturnFile] = useState<File | null>(null);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');

  const dispatchRoute =
    props.shipment.routeCode === 'LOCAL_DISPATCH' ||
    props.shipment.routeCode === 'NATIONAL_DISPATCH';
  const canDeliver =
    (dispatchRoute && props.shipment.status === 'IN_TRANSIT') ||
    (!dispatchRoute && props.shipment.status === 'READY');
  const canReturn =
    props.shipment.status === 'IN_TRANSIT' || props.shipment.status === 'DELIVERY_FAILED';

  return (
    <>
      {canDeliver ? (
        <div className={styles.actionBlock}>
          <h3>Confirmar entrega</h3>
          <label>
            Receptor {props.shipment.routeCode === 'CLIENT_PICKUP' ? '*' : ''}
            <input value={receivedBy} onChange={(event) => setReceivedBy(event.target.value)} />
          </label>
          <label>
            Evidencia *
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              onChange={(event) => setDeliveryFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            Observación
            <textarea value={observation} onChange={(event) => setObservation(event.target.value)} />
          </label>
          <button
            type="button"
            className={styles.primary}
            disabled={
              props.busy ||
              !props.canUpdate ||
              !deliveryFile ||
              (props.shipment.routeCode === 'CLIENT_PICKUP' && !receivedBy.trim())
            }
            onClick={() =>
              deliveryFile &&
              void props.onDeliver(
                props.shipment.id,
                props.order.id,
                props.shipment.version,
                deliveryFile,
                receivedBy,
                observation,
              )
            }
          >
            Confirmar entrega
          </button>
        </div>
      ) : null}

      {canDeliver ? (
        <details className={styles.actionBlock}>
          <summary>Registrar no entrega</summary>
          <label>
            Motivo *
            <input value={failureReason} onChange={(event) => setFailureReason(event.target.value)} />
          </label>
          <label>
            Evidencia opcional
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              onChange={(event) => setFailureFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            disabled={props.busy || !props.canUpdate || !failureReason.trim()}
            onClick={() =>
              void props.onFail(
                props.shipment.id,
                props.order.id,
                props.shipment.version,
                failureReason,
                observation,
                failureFile ?? undefined,
              )
            }
          >
            Registrar intento fallido
          </button>
        </details>
      ) : null}

      {props.shipment.status === 'DELIVERY_FAILED' ? (
        <button
          type="button"
          disabled={props.busy || !props.canUpdate}
          onClick={() => void props.onReprogram(props.shipment.id, props.shipment.version)}
        >
          Reprogramar entrega
        </button>
      ) : null}

      {canReturn ? (
        <details className={styles.actionBlock}>
          <summary>Registrar devolución</summary>
          <label>
            Causa *
            <input value={returnReason} onChange={(event) => setReturnReason(event.target.value)} />
          </label>
          <label>
            Evidencia *
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              onChange={(event) => setReturnFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            disabled={props.busy || !props.canUpdate || !returnReason.trim() || !returnFile}
            onClick={() =>
              returnFile &&
              void props.onReturn(
                props.shipment.id,
                props.order.id,
                props.shipment.version,
                returnReason,
                returnFile,
              )
            }
          >
            Registrar devolución
          </button>
        </details>
      ) : null}

      {props.shipment.status === 'DELIVERED' && !props.satisfaction ? (
        <div className={styles.actionBlock}>
          <h3>Satisfacción</h3>
          <label>
            Calificación
            <select value={rating} onChange={(event) => setRating(event.target.value)}>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>{value} / 5</option>
              ))}
            </select>
          </label>
          <label>
            Comentario
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
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
      ) : null}
    </>
  );
}
