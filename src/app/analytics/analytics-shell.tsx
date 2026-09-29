'use client';

import type { ReactNode } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';

interface AnalyticsShellProps {
  context: SessionContext;
  current: 'dashboard' | 'vsm' | 'reports' | 'imports';
  onSignOut(): Promise<void>;
  children: ReactNode;
}

function analyticsNavigation(
  context: SessionContext,
  current: AnalyticsShellProps['current'],
): AppShellNavigationItem[] {
  const items: AppShellNavigationItem[] = [];

  if (hasModuleCapability(context, 'dashboard', 'read')) {
    items.push({ href: '/analytics', label: 'Panel', current: current === 'dashboard' });
  }
  if (hasModuleCapability(context, 'vsm', 'read')) {
    items.push({ href: '/analytics/vsm', label: 'VSM', current: current === 'vsm' });
  }
  if (hasModuleCapability(context, 'reports', 'read')) {
    items.push({ href: '/analytics/reports', label: 'Reportes', current: current === 'reports' });
  }
  if (hasModuleCapability(context, 'imports', 'read')) {
    items.push({
      href: '/analytics/imports',
      label: 'Importaciones',
      current: current === 'imports',
    });
  }
  if (hasModuleCapability(context, 'orders', 'read')) {
    items.push({ href: '/orders', label: 'Pedidos' });
  }
  if (hasModuleCapability(context, 'workforce', 'read')) {
    items.push({ href: '/workforce', label: 'Jornada' });
  }
  if (hasModuleCapability(context, 'inventory', 'read')) {
    items.push({ href: '/inventory', label: 'Inventario' });
  }

  return items;
}

export function AnalyticsShell(props: AnalyticsShellProps) {
  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={analyticsNavigation(props.context, props.current)}
      onSignOut={props.onSignOut}
    >
      {props.children}
    </AppShell>
  );
}
