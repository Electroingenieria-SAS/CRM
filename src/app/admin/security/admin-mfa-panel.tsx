'use client';

import type { MfaEnrollment, MfaStatus } from '@/modules/admin/application/admin.schemas';
import styles from '../admin.module.css';

interface Props {
  mfa: MfaStatus | null;
  enrollment: MfaEnrollment | null;
  code: string;
  busy: boolean;
  setCode(value: string): void;
  enroll(): Promise<void>;
  verify(): Promise<void>;
}

export function AdminMfaPanel(props: Props) {
  return (
    <section className={styles.panel}>
      <h2>Autenticación multifactor</h2>
      <div className={styles.metricGrid}>
        <div className={styles.metric}>
          <small>Nivel actual</small>
          <strong>{props.mfa?.currentLevel ?? '—'}</strong>
        </div>
        <div className={styles.metric}>
          <small>Nivel disponible</small>
          <strong>{props.mfa?.nextLevel ?? '—'}</strong>
        </div>
        <div className={styles.metric}>
          <small>Factores</small>
          <strong>{props.mfa?.factors.length ?? 0}</strong>
        </div>
      </div>
      {!props.enrollment ? (
        <button
          className="primary-button"
          disabled={props.busy}
          onClick={() => void props.enroll()}
          type="button"
        >
          Registrar autenticador TOTP
        </button>
      ) : (
        <div className={styles.mfa}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.qr}
            src={props.enrollment.qrCode}
            alt="Código QR para configurar MFA"
          />
          <p className={styles.muted}>
            Clave manual: <code>{props.enrollment.secret}</code>
          </p>
          <label className={styles.field}>
            Código de seis dígitos
            <input
              inputMode="numeric"
              value={props.code}
              onChange={(event) => props.setCode(event.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={props.busy || props.code.trim().length < 6}
            onClick={() => void props.verify()}
            type="button"
          >
            Verificar MFA
          </button>
        </div>
      )}
    </section>
  );
}
