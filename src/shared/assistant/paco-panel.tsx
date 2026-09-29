'use client';

import type { PacoService } from '@/modules/assistant/application/paco-service';
import { canUseSpeechRecognition, speakPaco } from './paco-voice';
import { PacoActivityWizard } from './paco-activity-wizard';
import { PacoAlertList } from './paco-alert-list';
import type { ChatMessage } from './use-paco-chat';
import styles from './paco.module.css';

const quickActions = ['Resumen ahora', 'Ver cola', 'Quién está disponible', 'Registrar actividad'];

interface Props {
  paco: PacoService;
  alerts: Parameters<typeof PacoAlertList>[0]['alerts'];
  messages: ChatMessage[];
  input: string;
  busy: boolean;
  listening: boolean;
  wizard: boolean;
  voiceEnabled: boolean;
  setInput(value: string): void;
  setVoiceEnabled(value: boolean): void;
  close(): void;
  send(value: string): Promise<void>;
  cancel(): void;
  listen(): void;
  acknowledge(id: string): Promise<void>;
  completeWizard(message: string): void;
}

export function PacoPanel(props: Props) {
  return (
    <aside className={styles.panel} aria-label="PACO asistente operativo">
      <header className={styles.header}>
        <div><strong>PACO</strong><small>Asistente operativo</small></div>
        <div className={styles.headerActions}>
          <button type="button" onClick={() => props.setVoiceEnabled(!props.voiceEnabled)}>
            {props.voiceEnabled ? 'Voz activa' : 'Voz apagada'}
          </button>
          <button type="button" onClick={props.close} aria-label="Cerrar PACO">×</button>
        </div>
      </header>
      <PacoAlertList alerts={props.alerts} acknowledge={props.acknowledge} />
      <div className={styles.quick}>
        {quickActions.map((action) => (
          <button key={action} type="button" onClick={() => void props.send(action)} disabled={props.busy}>{action}</button>
        ))}
      </div>
      <div className={styles.messages} aria-live="polite">
        {props.messages.slice(-12).map((message) => (
          <p className={styles.message} data-role={message.role} key={message.id}>{message.text}</p>
        ))}
        {props.busy ? <p className={styles.typing}>PACO está consultando…</p> : null}
      </div>
      {props.wizard ? (
        <PacoActivityWizard paco={props.paco} onCancel={props.cancel} onComplete={props.completeWizard} />
      ) : null}
      <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void props.send(props.input); }}>
        <input aria-label="Mensaje para PACO" value={props.input} placeholder="Escribe tu consulta…" onChange={(event) => props.setInput(event.target.value)} />
        {canUseSpeechRecognition() ? (
          <button type="button" onClick={props.listen} disabled={props.listening}>{props.listening ? 'Escuchando…' : 'Voz'}</button>
        ) : null}
        <button type="submit" disabled={props.busy || !props.input.trim()}>Enviar</button>
      </form>
      <button className={styles.cancel} type="button" onClick={props.cancel}>Cancelar consulta</button>
    </aside>
  );
}
