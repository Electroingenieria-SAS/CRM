'use client';

import { useMemo, useState } from 'react';
import type { OrderDetailResponse } from '@/modules/orders/application/order.schemas';
import styles from './order-workflow-panel.module.css';

interface Props {
  detail: OrderDetailResponse;
  busy: boolean;
  onAddEvidence(input: {
    evidenceType: string;
    storageReference: string;
    fileName?: string;
  }): Promise<void>;
}

export function OrderEvidencePanel({ detail, busy, onAddEvidence }: Props) {
  const requiredType = useMemo(() => {
    const requirement = detail.workflow.missingRequirements.find(
      (item) => item.type === 'EVIDENCE' && typeof item.evidenceType === 'string',
    );
    return typeof requirement?.evidenceType === 'string' ? requirement.evidenceType : 'OPERATIONAL';
  }, [detail.workflow.missingRequirements]);

  const [reference, setReference] = useState('');

  return (
    <details className={styles.actionBox}>
      <summary>Agregar evidencia</summary>
      <p>
        Tipo: <strong>{requiredType}</strong>
      </p>
      <label>
        Referencia del archivo
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="ID o referencia segura del archivo"
        />
      </label>
      <button
        type="button"
        disabled={busy || !reference.trim()}
        onClick={() => onAddEvidence({ evidenceType: requiredType, storageReference: reference })}
      >
        Registrar evidencia
      </button>
    </details>
  );
}
