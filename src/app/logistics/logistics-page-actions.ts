import type { LogisticsPageActionDependencies } from './logistics-page-action-dependencies';
import { createLogisticsDeliveryActions } from './logistics-page-delivery-actions';
import { createLogisticsReleaseActions } from './logistics-page-release-actions';

export function createLogisticsPageActions(deps: LogisticsPageActionDependencies) {
  return {
    ...createLogisticsReleaseActions(deps),
    ...createLogisticsDeliveryActions(deps),
  };
}
