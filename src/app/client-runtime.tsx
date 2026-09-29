'use client';

import type { ReactNode } from 'react';
import { PacoLauncher } from '@/shared/assistant/paco-launcher';
import { ServiceWorkerRegistration } from '@/shared/pwa/service-worker-registration';
import { TelemetryBridge } from '@/shared/observability/telemetry-bridge';
import { PwaRegistration } from '@/shared/pwa/pwa-registration';

export function ClientRuntime({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PwaRegistration />
      <TelemetryBridge />
      <PacoLauncher />
      <ServiceWorkerRegistration />
    </>
  );
}
