'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPacoBrowserApplication } from '@/composition/paco-browser-application';
import type { AssistantAlert } from '@/modules/assistant/application/assistant.schemas';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import { PacoActivityWizard } from './paco-activity-wizard';
import {
  canUseSpeechRecognition,
  speakPaco,
  startPacoRecognition,
} from './paco-voice';
import styles from './paco.module.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const quickActions = ['Resumen ahora', 'Ver cola', 'Quién está disponible', 'Registrar actividad'];

export function PacoLauncher() {
  const router = useRouter();
  const application = useMemo(() => createPacoBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hola. Soy PACO. Puedo ayudarte con pedidos, colas, ocupación, actividades y pendientes.',
    },
  ]);
  const [alerts, setAlerts] = useState<AssistantAlert[]>([]);
  const [wizard, setWizard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!application) return;
    let active = true;

    const restore = async () => {
      const session = await application.auth.restoreContext();
      if (!active) return;
      setContext(session);
    };

    void restore();
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') {
        setContext(null);
        setOpen(false);
      } else {
        void restore();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [application]);

  async function refreshAlerts(announce: boolean) {
    if (!application || !context || !hasModuleCapability(context, 'assistant', 'read')) return;
    try {
      const next = await application.paco.alerts(true);
      setAlerts(next);
      if (announce && voiceEnabled) {
        const toSpeak = next.filter((alert) => alert.shouldNotify).slice(0, 2);
        for (const alert of toSpeak) speakPaco(alert.message);
      }
    } catch {
      // Alerts are advisory; chat remains available if refresh fails.
    }
  }

  useEffect(() => {
    if (context && hasModuleCapability(context, 'assistant', 'read')) {
      void refreshAlerts(true);
    }
    // Initial session/permission change only; no polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  if (!application || !context || !hasModuleCapability(context, 'assistant', 'read')) return null;

  function add(role: ChatMessage['role'], text: string) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text }]);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    setBusy(true);
    add('user', message);
    setInput('');
    try {
      const reply = await application.paco.ask(message);
      if (reply.action === 'CANCEL') {
        setWizard(false);
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', text: reply.text }]);
      } else {
        add('assistant', reply.text);
      }
      if (reply.action === 'START_ACTIVITY_WIZARD') setWizard(true);
      if (reply.action === 'NAVIGATE' && reply.href) router.push(reply.href);
      if (voiceEnabled && reply.text.length <= 320) speakPaco(reply.text);
      if (reply.suggestions?.length) {
        // Suggestions remain available through the fixed quick actions to avoid message clutter.
      }
      if (/resumen|cola|ocupad|dispon/i.test(message)) await refreshAlerts(false);
    } catch (error) {
      add('assistant', error instanceof Error ? error.message : 'No pude completar la consulta.');
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setWizard(false);
    setMessages([
      { id: crypto.randomUUID(), role: 'assistant', text: 'Consulta cancelada. Empecemos de nuevo.' },
    ]);
    setInput('');
  }

  function listen() {
    if (listening) return;
    setListening(true);
    const stop = startPacoRecognition(
      (text) => {
        setListening(false);
        setInput(text);
      },
      () => {
        setListening(false);
        add('assistant', 'No pude usar el micrófono. Puedes continuar escribiendo.');
      },
    );
    window.setTimeout(() => {
      stop();
      setListening(false);
    }, 12_000);
  }

  async function acknowledge(alertId: string) {
    try {
      await application.paco.acknowledgeAlert(alertId);
      setAlerts((current) =>
        current.map((alert) =>
          alert.id === alertId ? { ...alert, status: 'ACKNOWLEDGED', shouldNotify: false } : alert,
        ),
      );
    } catch (error) {
      add('assistant', error instanceof Error ? error.message : 'No pude confirmar la alerta.');
    }
  }

  const openAlerts = alerts.filter((alert) => alert.status === 'OPEN');

  return (
    <>
      <button
        className={styles.launcher}
        type="button"
        aria-label="Abrir PACO"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void refreshAlerts(false);
        }}
      >
        PACO
        {openAlerts.length ? <span className={styles.counter}>{Math.min(openAlerts.length, 9)}</span> : null}
      </button>

      {open ? (
        <aside className={styles.panel} aria-label="PACO asistente operativo">
          <header className={styles.header}>
            <div>
              <strong>PACO</strong>
              <small>Asistente operativo</small>
            </div>
            <div className={styles.headerActions}>
              <button type="button" onClick={() => setVoiceEnabled((value) => !value)}>
                {voiceEnabled ? 'Voz activa' : 'Voz apagada'}
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar PACO">×</button>
            </div>
          </header>

          {openAlerts.length ? (
            <section className={styles.alerts} aria-label="Alertas PACO">
              {openAlerts.slice(0, 3).map((alert) => (
                <article className={styles.alert} data-severity={alert.severity} key={alert.id}>
                  <strong>{alert.title}</strong>
                  <span>{alert.message}</span>
                  <button type="button" onClick={() => void acknowledge(alert.id)}>Entendido</button>
                </article>
              ))}
            </section>
          ) : null}

          <div className={styles.quick}>
            {quickActions.map((action) => (
              <button key={action} type="button" onClick={() => void send(action)} disabled={busy}>
                {action}
              </button>
            ))}
          </div>

          <div className={styles.messages} aria-live="polite">
            {messages.slice(-12).map((message) => (
              <p className={styles.message} data-role={message.role} key={message.id}>
                {message.text}
              </p>
            ))}
            {busy ? <p className={styles.typing}>PACO está consultando…</p> : null}
          </div>

          {wizard ? (
            <PacoActivityWizard
              paco={application.paco}
              onCancel={cancel}
              onComplete={(message) => {
                setWizard(false);
                add('assistant', message);
                if (voiceEnabled) speakPaco(message);
              }}
            />
          ) : null}

          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <input
              aria-label="Mensaje para PACO"
              value={input}
              placeholder="Escribe tu consulta…"
              onChange={(event) => setInput(event.target.value)}
            />
            {canUseSpeechRecognition() ? (
              <button type="button" onClick={listen} disabled={listening}>
                {listening ? 'Escuchando…' : 'Voz'}
              </button>
            ) : null}
            <button type="submit" disabled={busy || !input.trim()}>Enviar</button>
          </form>

          <button className={styles.cancel} type="button" onClick={cancel}>
            Cancelar consulta
          </button>
        </aside>
      ) : null}
    </>
  );
}
