'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PacoBrowserApplication } from '@/composition/paco-browser-application';
import type { AssistantAlert } from '@/modules/assistant/application/assistant.schemas';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import { speakPaco } from './paco-voice';

export function usePacoAlerts(
  application: PacoBrowserApplication | null,
  context: SessionContext | null,
  voiceEnabled: boolean,
) {
  const [alerts, setAlerts] = useState<AssistantAlert[]>([]);

  const refresh = useCallback(async (announce: boolean) => {
    if (!application || !context || !hasModuleCapability(context, 'assistant', 'read')) return;
    try {
      const next = await application.paco.alerts(true);
      setAlerts(next);
      if (announce && voiceEnabled) {
        for (const alert of next.filter((item) => item.shouldNotify).slice(0, 2)) {
          speakPaco(alert.message);
        }
      }
    } catch {
      // Advisory alerts never block the assistant.
    }
  }, [application, context, voiceEnabled]);

  useEffect(() => {
    if (!context || !hasModuleCapability(context, 'assistant', 'read')) return;
    const timer = window.setTimeout(() => void refresh(true), 0);
    return () => window.clearTimeout(timer);
  }, [context, refresh]);

  async function acknowledge(alertId: string) {
    if (!application) return;
    await application.paco.acknowledgeAlert(alertId);
    setAlerts((current) =>
      current.map((alert) =>
        alert.id === alertId ? { ...alert, status: 'ACKNOWLEDGED', shouldNotify: false } : alert,
      ),
    );
  }

  return { alerts, refresh, acknowledge };
}
