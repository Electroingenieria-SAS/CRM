'use client';

import { useEffect, useState } from 'react';
import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type { LogisticsDetail } from '@/modules/logistics/application/logistics.schemas';
import styles from './logistics-ui.module.css';

interface OperationPanelProps {
  detail: LogisticsDetail | null;
  catalog: FreightCatalog;
  busy: boolean;
  canUpdate: boolean;
  canCorrectCost: boolean;
  onSaveGuide(shipmentId: string, carrierId: string, tracking: string): Promise<void>;
  onDispatch(
    shipmentId: string,
    orderId: string,
    version: number,
    actualFreight?: number,
  ): Promise<void>;
  onSetActualCost(shipmentId: string, version: number, cost: number): Promise<void>;
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

function money(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function LogisticsOperationPanel(props: OperationPanelProps) {
  const shipment = props.detail?.shipment;
  const order = props.detail?.order;
  const [carrierId, setCarrierId] = useState('');
  const [tracking, setTracking] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [observation, setObservation] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [failureFile, setFailureFile] = useState<File | null>(null);
  const [returnFile, setReturnFile] = useState<File | null>(null);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');

  useEffect(() => {
    setCarrierId(shipment?.carrierId ?? '');
    setTracking(shipment?.trackingNumber ?? '');
    setActualCost(shipment?.actualFreight?.toString() ?? '');
    setReceivedBy(shipment?.receivedBy ?? '');
  }, [shipment?.id, shipment?.carrierId, shipment?.trackingNumber, shipment?.actualFreight, shipment?.receivedBy]);

  if (!shipment || !order) {
    return (
      <section className={styles.panel}>
        <h2>Operación</h2>
        <p className={styles.empty}>Selecciona un despacho para gestionarlo.</p>
      </section>
    );
  }

  const dispatchRoute =
    shipment.routeCode === 'LOCAL_DISPATCH' || shipment.routeCode === 'NATIONAL_DISPATCH';
  const canDispatch = dispatchRoute && shipment.status === 'READY';
  const canDeliver =
    (dispatchRoute && shipment.status === 'IN_TRANSIT') ||
    (!dispatchRoute && shipment.status === 'READY');
  const canFail = canDeliver;
  const canReturn = shipment.status === 'IN_TRANSIT' || shipment.status === 'DELIVERY_FAILED';

  return (
    <section className={styles.panel} aria-labelledby="logistics-operation-title">
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Operación</p>
          <h2 id="logistics-operation-title">{order.orderNumber}</h2>
          <p>{order.customerName}</p>
        </div>
        <span className={styles.badge}>{shipment.status.replaceAll('_', ' ')}</span>
      </div>

      <dl className={styles.definitionGrid}>
        <div><dt>Modalidad</dt><dd>{shipment.routeCode.replaceAll('_', ' ')}</dd></div>
        <div><dt>Destino</dt><dd>{order.city || '—'} · {order.address || '—'}</dd></div>
        <div><dt>Estimado</dt><dd>{money(shipment.estimatedFreight)}</dd></div>
        <div><dt>Real</dt><dd>{money(shipment.actualFreight)}</dd></div>
      </dl>

      {dispatchRoute && shipment.status === 'READY' ? (
        <div className={styles.formGrid}>
          <label>
            Transportadora
            <select value={carrierId} onChange={(event) => setCarrierId(event.target.value)}>
              <option value="">Seleccionar</option>
              {props.catalog.carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
              ))}
            </select>
          </label>
          <label>
            Número de guía
            <input value={tracking} onChange={(event) => setTracking(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={props.busy || !props.canUpdate || !carrierId || !tracking.trim()}
            onClick={() => void props.onSaveGuide(shipment.id, carrierId, tracking.trim())}
          >
            Guardar guía
          </button>
        </div>
      ) : null}

      {canDispatch ? (
        <div className={styles.actionBlock}>
          <label>
            Costo real de salida, si ya se conoce
            <input
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={actualCost}
              onChange={(event) => setActualCost(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.primary}
            disabled={props.busy || !props.canUpdate}
            onClick={() =>
              void props.onDispatch(
                shipment.id,
                order.id,
                shipment.version,
                actualCost === '' ? undefined : Number(actualCost),
              )
            }
          >
            Registrar salida
          </button>
        </div>
      ) : null}

      {shipment.status !== 'READY' && props.canCorrectCost ? (
        <div className={styles.actionBlock}>
          <label>
            Corregir costo real
            <input
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={actualCost}
              onChange={(event) => setActualCost(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={props.busy || actualCost === ''}
            onClick={() =>
              void props.onSetActualCost(shipment.id, shipment.version, Number(actualCost))
            }
          >
            Guardar costo real
          </button>
        </div>
      ) : null}

      {canDeliver ? (
        <div className={styles.actionBlock}>
          <h3>Confirmar entrega</h3>
          <label>
            Receptor {shipment.routeCode === 'CLIENT_PICKUP' ? '*' : ''}
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
              (shipment.routeCode === 'CLIENT_PICKUP' && !receivedBy.trim())
            }
            onClick={() =>
              deliveryFile &&
              void props.onDeliver(
                shipment.id,
                order.id,
                shipment.version,
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

      {canFail ? (
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
                shipment.id,
                order.id,
                shipment.version,
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

      {shipment.status === 'DELIVERY_FAILED' ? (
        <button
          type="button"
          disabled={props.busy || !props.canUpdate}
          onClick={() => void props.onReprogram(shipment.id, shipment.version)}
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
                shipment.id,
                order.id,
                shipment.version,
                returnReason,
                returnFile,
              )
            }
          >
            Registrar devolución
          </button>
        </details>
      ) : null}

      {shipment.status === 'DELIVERED' && !props.detail.satisfaction ? (
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
            onClick={() => void props.onSatisfaction(shipment.id, Number(rating), comment)}
          >
            Guardar satisfacción
          </button>
        </div>
      ) : null}
    </section>
  );
}
