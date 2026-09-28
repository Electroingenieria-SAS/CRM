import type { SessionContext } from '@/modules/auth/application/session.schemas';

export type ModuleCapability = 'read' | 'create' | 'update' | 'approve' | 'admin';

const capabilityField = {
  read: 'canRead',
  create: 'canCreate',
  update: 'canUpdate',
  approve: 'canApprove',
  admin: 'canAdmin',
} as const;

export function hasModuleCapability(
  context: Pick<SessionContext, 'modules'>,
  moduleCode: string,
  capability: ModuleCapability,
): boolean {
  const moduleAccess = context.modules.find((module) => module.code === moduleCode);
  return Boolean(moduleAccess?.[capabilityField[capability]]);
}
