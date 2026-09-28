import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { AppShellNavigationItem } from '@/shared/ui/app-shell';

export function financeNavigation(
  context: SessionContext,
  current: 'credit' | 'cartera' | 'caja' | 'approvals',
): AppShellNavigationItem[] {
  const items: AppShellNavigationItem[] = [
    { href: '/orders', label: 'Pedidos' },
  ];

  if (hasModuleCapability(context, 'credit', 'read')) {
    items.push({ href: '/finance/credit', label: 'Crédito', current: current === 'credit' });
  }
  if (hasModuleCapability(context, 'cartera', 'read')) {
    items.push({ href: '/finance/receivables', label: 'Cartera', current: current === 'cartera' });
  }
  if (hasModuleCapability(context, 'caja', 'read')) {
    items.push({ href: '/finance/cash', label: 'Caja', current: current === 'caja' });
  }
  if (hasModuleCapability(context, 'approvals', 'read')) {
    items.push({
      href: '/finance/approvals',
      label: 'Aprobaciones',
      current: current === 'approvals',
    });
  }

  return items;
}
