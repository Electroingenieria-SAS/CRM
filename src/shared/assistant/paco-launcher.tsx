'use client';

import { useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import { PacoPanel } from './paco-panel';
import { speakPaco } from './paco-voice';
import styles from './paco.module.css';
import { usePacoAlerts } from './use-paco-alerts';
import { usePacoChat } from './use-paco-chat';
import { usePacoSession } from './use-paco-session';

export function PacoLauncher() {
  const { application, context } = usePacoSession();
  const [open, setOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const alertState = usePacoAlerts(application, context, voiceEnabled);

  if (!application || !context || !hasModuleCapability(context, 'assistant', 'read')) return null;

  return (
    <PacoLauncherReady
      application={application}
      open={open}
      setOpen={setOpen}
      voiceEnabled={voiceEnabled}
      setVoiceEnabled={setVoiceEnabled}
      alerts={alertState.alerts}
      refreshAlerts={alertState.refresh}
      acknowledge={alertState.acknowledge}
    />
  );
}

interface ReadyProps {
  application: NonNullable<ReturnType<typeof usePacoSession>['application']>;
  open: boolean;
  voiceEnabled: boolean;
  alerts: ReturnType<typeof usePacoAlerts>['alerts'];
  setOpen(value: boolean): void;
  setVoiceEnabled(value: boolean): void;
  refreshAlerts(announce: boolean): Promise<void>;
  acknowledge(id: string): Promise<void>;
}

function PacoLauncherReady(props: ReadyProps) {
  const chat = usePacoChat(props.application, props.voiceEnabled, props.refreshAlerts);
  const openAlerts = props.alerts.filter((alert) => alert.status === 'OPEN');

  function completeWizard(message: string) {
    chat.setWizard(false);
    chat.add('assistant', message);
    if (props.voiceEnabled) speakPaco(message);
  }

  return (
    <>
      <button
        className={styles.launcher}
        type="button"
        aria-label="Abrir PACO"
        aria-expanded={props.open}
        onClick={() => {
          props.setOpen(!props.open);
          if (!props.open) void props.refreshAlerts(false);
        }}
      >
        PACO
        {openAlerts.length ? (
          <span className={styles.counter}>{Math.min(openAlerts.length, 9)}</span>
        ) : null}
      </button>
      {props.open ? (
        <PacoPanel
          paco={props.application.paco}
          alerts={openAlerts}
          messages={chat.messages}
          input={chat.input}
          busy={chat.busy}
          listening={chat.listening}
          wizard={chat.wizard}
          voiceEnabled={props.voiceEnabled}
          setInput={chat.setInput}
          setVoiceEnabled={props.setVoiceEnabled}
          close={() => props.setOpen(false)}
          send={chat.send}
          cancel={chat.cancel}
          listen={chat.listen}
          acknowledge={props.acknowledge}
          completeWizard={completeWizard}
        />
      ) : null}
    </>
  );
}
