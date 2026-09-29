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

function GuideForm(props: {
  shipment: Shipment;
  catalog: FreightCatalog;
  busy: boolean;
  canUpdate: boolean;
  carrierId: string;
  tracking: string;
  setCarrierId(value: string): void;
  setTracking(value: string): void;
  onSaveGuide: DispatchActionsProps['onSaveGuide'];
}) {
  return (
    <div className={styles.formGrid}>
      <label>
        Transportadora
        <select value={props.carrierId} onChange={(e) => props.setCarrierId(e.target.value)}>
          <option value="">Seleccionar</option>
          {props.catalog.carriers.map((carrier) => (
            <option key={carrier.id} value={carrier.id}>
              {carrier.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Número de guía
        <input value={props.tracking} onChange={(e) => props.setTracking(e.target.value)} />
      </label>
      <button
        type="button"
        disabled={props.busy || !props.canUpdate || !props.carrierId || !props.tracking.trim()}
        onClick={() =>
          void props.onSaveGuide(props.shipment.id, props.carrierId, props.tracking.trim())
        }
      >
        Guardar guía
      </button>
    </div>
  );
}

function DispatchForm(props: {
  shipment: Shipment;
  orderId: string;
  busy: boolean;
  canUpdate: boolean;
  actualCost: string;
  setActualCost(value: string): void;
  onDispatch: DispatchActionsProps['onDispatch'];
}) {
  return (
    <div className={styles.actionBlock}>
      <label>
        Costo real de salida, si ya se conoce
        <input
          inputMode="decimal"
          type="number"
          min="0"
          step="0.01"
          value={props.actualCost}
          onChange={(e) => props.setActualCost(e.target.value)}
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
            props.actualCost === '' ? undefined : Number(props.actualCost),
          )
        }
      >
        Registrar salida
      </button>
    </div>
  );
}

function ActualCostForm(props: {
  shipment: Shipment;
  busy: boolean;
  actualCost: string;
  setActualCost(value: string): void;
  onSetActualCost: DispatchActionsProps['onSetActualCost'];
}) {
  return (
    <div className={styles.actionBlock}>
      <label>
        Corregir costo real
        <input
          inputMode="decimal"
          type="number"
          min="0"
          step="0.01"
          value={props.actualCost}
          onChange={(e) => props.setActualCost(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={props.busy || props.actualCost === ''}
        onClick={() =>
          void props.onSetActualCost(
            props.shipment.id,
            props.shipment.version,
            Number(props.actualCost),
          )
        }
      >
        Guardar costo real
      </button>
    </div>
  );
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
      {canDispatch ? (
        <GuideForm
          shipment={props.shipment}
          catalog={props.catalog}
          busy={props.busy}
          canUpdate={props.canUpdate}
          carrierId={carrierId}
          tracking={tracking}
          setCarrierId={setCarrierId}
          setTracking={setTracking}
          onSaveGuide={props.onSaveGuide}
        />
      ) : null}
      {canDispatch ? (
        <DispatchForm
          shipment={props.shipment}
          orderId={props.orderId}
          busy={props.busy}
          canUpdate={props.canUpdate}
          actualCost={actualCost}
          setActualCost={setActualCost}
          onDispatch={props.onDispatch}
        />
      ) : null}
      {props.shipment.status !== 'READY' && props.canCorrectCost ? (
        <ActualCostForm
          shipment={props.shipment}
          busy={props.busy}
          actualCost={actualCost}
          setActualCost={setActualCost}
          onSetActualCost={props.onSetActualCost}
        />
      ) : null}
    </>
  );
}
