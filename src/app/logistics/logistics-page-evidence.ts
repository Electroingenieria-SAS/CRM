import type { LogisticsPageActionDependencies } from './logistics-page-action-dependencies';

export async function uploadLogisticsEvidence(
  deps: LogisticsPageActionDependencies,
  orderId: string,
  type: string,
  file: File,
) {
  if (!deps.application || !deps.context) {
    throw new Error('La sesión no está disponible.');
  }
  return deps.application.logistics.uploadEvidence(
    deps.context.organization.id,
    orderId,
    type,
    file,
    crypto.randomUUID(),
  );
}
