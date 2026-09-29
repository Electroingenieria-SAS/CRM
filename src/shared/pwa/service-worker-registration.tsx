'use client';

import { useEffect } from 'react';
import { logStructured } from '@/shared/observability/logger';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

    let disposed = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (disposed) return;

        await registration.update().catch(() => undefined);

        logStructured({
          level: 'info',
          event: 'service_worker_registered',
          module: 'pwa',
          context: { scope: registration.scope },
        });
      } catch (error) {
        logStructured({
          level: 'warn',
          event: 'service_worker_registration_failed',
          module: 'pwa',
          context: { message: error instanceof Error ? error.message : 'unknown' },
        });
      }
    };

    void register();
    return () => {
      disposed = true;
    };
  }, []);

  return null;
}
