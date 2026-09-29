'use client';

import styles from '../admin.module.css';

interface Props {
  name: string;
  timezone: string;
  canAdmin: boolean;
  busy: boolean;
  setName(value: string): void;
  setTimezone(value: string): void;
  save(): Promise<void>;
}

export function AdminOrganizationPanel(props: Props) {
  return (
    <section className={styles.panel}>
      <h2>Organización</h2>
      <div className={styles.form}>
        <label>
          Nombre
          <input value={props.name} onChange={(event) => props.setName(event.target.value)} />
        </label>
        <label>
          Zona horaria
          <input value={props.timezone} onChange={(event) => props.setTimezone(event.target.value)} />
        </label>
        <button className="primary-button" disabled={!props.canAdmin || props.busy} onClick={() => void props.save()} type="button">
          Guardar configuración
        </button>
      </div>
    </section>
  );
}
