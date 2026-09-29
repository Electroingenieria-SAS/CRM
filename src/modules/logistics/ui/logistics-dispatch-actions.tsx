'use client';

import { useState } from 'react';
import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type { LogisticsDetail } from '@/modules/logistics/application/logistics.schemas';
import styles from './logistics-ui.module.css';

type Shipment = NonNullable<LogisticsDetail['shipment']>;

interface DispatchActionsProps {
  shipment: Shipment;
  orderId: string;
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
}

export function LogisticsDispatchActions(props: DispatchActionsProps) {
  const [carrierId, setCarrierId] = useState(props.shipment.carrierId ?? '');
  const [tracking, setTracking] = useState(props.shipment.trackingNumber ?? '');
  const [actualCost, setActualCost] = useState(props.shipment.actualFreight?.toString() ?? '');

  const dispatchRoute =
    props.shipment.routeCode === 'LOCAL_DISPATCH' ||
    props.shipment.routeCode === 'NATIONAL_DISPATCH';
  const canDispatch = dispatchRoute && props.shipment.status === 'READY';

  return (
    <>
      {dispatchRoute && props.shipment.status === 'READY' ? (
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
            onClick={() =>
              void props.onSaveGuide(props.shipment.id, carrierId, tracking.trim())
            }
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
                props.shipment.id,
                props.orderId,
                props.shipment.version,
                actualCost === '' ? undefined : Number(actualCost),
              )
            }
          >
            Registrar salida
          </button>
        </div>
      ) : null}

      {props.shipment.status !== 'READY' && props.canCorrectCost ? (
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
              void props.onSetActualCost(
                props.shipment.id,
                props.shipment.version,
                Number(actualCost),
              )
            }
          >
            Guardar costo real
          </button>
        </div>
      ) : null}
    </>
  );
}
