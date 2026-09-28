'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './app-shell.module.css';

interface AppShellProps {
  userName: string;
  organizationName: string;
  onSignOut(): Promise<void>;
  children: ReactNode;
}

export function AppShell({ userName, organizationName, onSignOut, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Navegación principal">
        <div className={styles.brand}>
          <span>EI</span>
          <div>
            <strong>CRM</strong>
            <small>{organizationName}</small>
          </div>
        </div>
        <nav className={styles.nav}>
          <Link href="/orders" aria-current="page">
            Pedidos
          </Link>
        </nav>
        <div className={styles.account}>
          <span>{userName}</span>
          <button type="button" onClick={() => void onSignOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main id="main-content" className={styles.content}>
        {children}
      </main>
    </div>
  );
}
