'use client';

import { useState } from 'react';
import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightPredictionResult } from '@/modules/freight/application/freight-prediction.schemas';
import type {
  LogisticsCandidate,
  LogisticsRoute,
} from '@/modules/logistics/application/logistics.schemas';
import type { LogisticsReleaseInput } from '@/modules/logistics/ports/logistics-ports';
import styles from './logistics-ui.module.css';

interface ReleasePanelProps {
  candidate: LogisticsCandidate | null;
  catalog: FreightCatalog;
  prediction: FreightPredictionResult | null;
  busy: boolean;
  canRelease: boolean;
  onEstimate(
    orderId: string,
    routeCode: 'LOCAL_DISPATCH' | 'NATIONAL_DISPATCH',
    destinationId: string,
    carrierId?: string,
  ): Promise<void>;
  onRelease(orderId: string, input: LogisticsReleaseInput): Promise<void>;
}

function needsFreight(route: LogisticsRoute) {
  return route === 'LOCAL_DISPATCH' || route === 'NATIONAL_DISPATCH';
}

function ReleaseSummary({ candidate }: { candidate: LogisticsCandidate }) {
  return (
    <>
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Pedido listo</p>
          <h2 id="release-title">{candidate.orderNumber}</h2>
          <p>{candidate.customerName}</p>
        </div>
        <span className={styles.badge}>{candidate.routeCode.replaceAll('_', ' ')}</span>
      </div>
      <dl className={styles.definitionGrid}>
        <div>
          <dt>Destino</dt>
          <dd>
            {candidate.city || 'Sin ciudad'} · {candidate.address || 'Sin dirección'}
          </dd>
        </div>
        <div>
          <dt>Facturación</dt>
          <dd>{candidate.readiness.billingReady ? 'Lista' : 'Pendiente'}</dd>
        </div>
        <div>
          <dt>Finance</dt>
          <dd>{candidate.readiness.financialDecision}</dd>
        </div>
      </dl>
    </>
  );
}

function PredictionCard({ prediction }: { prediction: FreightPredictionResult }) {
  const amount =
    prediction.available && prediction.estimateMid !== undefined
      ? new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(prediction.estimateMid)
      : 'Histórico insuficiente';

  return (
    <div className={styles.prediction}>
      <strong>{amount}</strong>
      <span>
        {prediction.carrierName || 'Sin transportadora sugerida'} · {prediction.evidenceLevel}
      </span>
      {prediction.estimateLow !== undefined && prediction.estimateHigh !== undefined ? (
        <small>
          Rango: {prediction.estimateLow.toLocaleString('es-CO')} –{' '}
          {prediction.estimateHigh.toLocaleString('es-CO')} COP
        </small>
      ) : null}
    </div>
  );
}

function FreightControls(props: {
  candidate: LogisticsCandidate;
  catalog: FreightCatalog;
  busy: boolean;
  destinationId: string;
  carrierId: string;
  setDestinationId(value: string): void;
  setCarrierId(value: string): void;
  onEstimate: ReleasePanelProps['onEstimate'];
}) {
  return (
    <div className={styles.formGrid}>
      <label>
        Destino Freight
        <select
          required
          value={props.destinationId}
          onChange={(e) => props.setDestinationId(e.target.value)}
        >
          <option value="">Seleccionar destino</option>
          {props.catalog.destinations.map((destination) => (
            <option key={destination.id} value={destination.id}>
              {destination.city}, {destination.department}
            </option>
          ))}
        </select>
      </label>
      <label>
        Transportadora
        <select value={props.carrierId} onChange={(e) => props.setCarrierId(e.target.value)}>
          <option value="">Sugerir con histórico</option>
          {props.catalog.carriers.map((carrier) => (
            <option key={carrier.id} value={carrier.id}>
              {carrier.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={props.busy || !props.destinationId}
        onClick={() =>
          void props.onEstimate(
            props.candidate.orderId,
            props.candidate.routeCode as 'LOCAL_DISPATCH' | 'NATIONAL_DISPATCH',
            props.destinationId,
            props.carrierId || undefined,
          )
        }
      >
        Estimar flete
      </button>
    </div>
  );
}

export function LogisticsReleasePanel(props: ReleasePanelProps) {
  const [destinationId, setDestinationId] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const candidate = props.candidate;

  if (!candidate) {
    return (
      <section className={styles.panel}>
        <h2>Liberación</h2>
        <p className={styles.empty}>Selecciona un pedido listo para logística.</p>
      </section>
    );
  }

  const freightRequired = needsFreight(candidate.routeCode);
  const prediction = props.prediction?.destinationId === destinationId ? props.prediction : null;

  const release = () => {
    const input: LogisticsReleaseInput = {};
    if (freightRequired) {
      input.destinationId = destinationId || undefined;
      input.carrierId = carrierId || prediction?.carrierId || undefined;
      input.predictionId = prediction?.predictionId;
      input.estimatedFreight = prediction?.estimateMid;
      input.estimatedFreightLow = prediction?.estimateLow;
      input.estimatedFreightHigh = prediction?.estimateHigh;
    }
    void props.onRelease(candidate.orderId, input);
  };

  return (
    <section className={styles.panel} aria-labelledby="release-title">
      <ReleaseSummary candidate={candidate} />
      {freightRequired ? (
        <FreightControls
          candidate={candidate}
          catalog={props.catalog}
          busy={props.busy}
          destinationId={destinationId}
          carrierId={carrierId}
          setDestinationId={setDestinationId}
          setCarrierId={setCarrierId}
          onEstimate={props.onEstimate}
        />
      ) : null}
      {prediction ? <PredictionCard prediction={prediction} /> : null}
      <button
        type="button"
        className={styles.primary}
        disabled={
          props.busy ||
          !props.canRelease ||
          !candidate.readiness.readyForLogistics ||
          (freightRequired && !destinationId)
        }
        onClick={release}
      >
        Liberar pedido
      </button>
    </section>
  );
}
