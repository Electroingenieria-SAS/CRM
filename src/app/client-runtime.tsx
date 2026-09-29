'use client';

import type { ReactNode } from 'react';
import { PacoLauncher } from '@/shared/assistant/paco-launcher';
import { PwaRegistration } from '@/shared/pwa/pwa-registration';

export function ClientRuntime({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PwaRegistration />
      <PacoLauncher />
    </>
  );
}
