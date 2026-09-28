'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './app-shell.module.css';

export interface AppShellNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly current?: boolean;
}

interface AppShellProps {
  userName: string;
  organizationName: string;
  navigation: readonly AppShellNavigationItem[];
  onSignOut(): Promise<void>;
  children: ReactNode;
}

export function AppShell({
  userName,
  organizationName,
  navigation,
  onSignOut,
  children,
}: AppShellProps) {
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
          {navigation.map((item) => (
            <Link
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
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
