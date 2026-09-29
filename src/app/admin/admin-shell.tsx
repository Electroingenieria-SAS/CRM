'use client';

import type { ReactNode } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';

interface AdminShellProps {
  context: SessionContext;
  current: 'users' | 'roles' | 'security';
  onSignOut(): Promise<void>;
  children: ReactNode;
}

function navigation(context: SessionContext, current: AdminShellProps['current']) {
  const items: AppShellNavigationItem[] = [
    { href: '/admin', label: 'Usuarios', current: current === 'users' },
    { href: '/admin/roles', label: 'Roles y permisos', current: current === 'roles' },
    { href: '/admin/security', label: 'Seguridad', current: current === 'security' },
  ];
  if (hasModuleCapability(context, 'audit', 'read'))
    items.push({ href: '/audit', label: 'Auditoría' });
  if (hasModuleCapability(context, 'dashboard', 'read'))
    items.push({ href: '/analytics', label: 'Panel' });
  if (hasModuleCapability(context, 'orders', 'read'))
    items.push({ href: '/orders', label: 'Pedidos' });
  return items;
}

export function AdminShell(props: AdminShellProps) {
  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={navigation(props.context, props.current)}
      onSignOut={props.onSignOut}
    >
      {props.children}
    </AppShell>
  );
}
