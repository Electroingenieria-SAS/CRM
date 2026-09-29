'use client';

import { useEffect } from 'react';
import { logStructured } from '@/shared/observability/logger';

export function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        const activateUpdate = (worker: ServiceWorker | null) => {
          if (worker?.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        };
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => activateUpdate(worker));
        });
      })
      .catch((error) => {
        logStructured({
          level: 'warn',
          event: 'pwa_registration_failed',
          module: 'pwa',
          context: { message: error instanceof Error ? error.message : 'registration failed' },
        });
      });

    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  return null;
}
