'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import { AppShell } from '@/shared/ui/app-shell';
import {
  LogisticsWorkspaceBody,
  type LogisticsWorkspaceBodyProps,
} from './logistics-workspace-body';
import { logisticsNavigation } from './logistics-workspace-sections';

interface LogisticsWorkspaceProps extends Omit<
  LogisticsWorkspaceBodyProps,
  'canRelease' | 'canUpdate' | 'canCorrectCost' | 'canSatisfaction'
> {
  context: SessionContext;
  onSignOut(): Promise<void>;
}

function logisticsCapabilities(context: SessionContext) {
  const canUpdate = hasModuleCapability(context, 'shipping', 'update');
  return {
    canRelease: hasModuleCapability(context, 'shipping', 'create'),
    canUpdate,
    canCorrectCost:
      hasModuleCapability(context, 'shipping', 'approve') ||
      hasModuleCapability(context, 'freight', 'update'),
    canSatisfaction: canUpdate || hasModuleCapability(context, 'sales', 'create'),
  };
}

export function LogisticsWorkspace(props: LogisticsWorkspaceProps) {
  const capabilities = logisticsCapabilities(props.context);
  const { context, onSignOut, ...bodyProps } = props;

  return (
    <AppShell
      userName={context.profile.name}
      organizationName={context.organization.name}
      navigation={logisticsNavigation(context)}
      onSignOut={onSignOut}
    >
      <LogisticsWorkspaceBody {...bodyProps} {...capabilities} />
    </AppShell>
  );
}
