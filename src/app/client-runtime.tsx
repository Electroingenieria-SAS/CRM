'use client';

import type { ReactNode } from 'react';
import { PacoLauncher } from '@/shared/assistant/paco-launcher';

export function ClientRuntime({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PacoLauncher />
    </>
  );
}
