import type { LogisticsPageActionDependencies } from './logistics-page-action-dependencies';
import { createLogisticsPrimaryDeliveryActions } from './logistics-page-primary-delivery-actions';
import { createLogisticsSecondaryDeliveryActions } from './logistics-page-secondary-delivery-actions';

export function createLogisticsDeliveryActions(deps: LogisticsPageActionDependencies) {
  return {
    ...createLogisticsPrimaryDeliveryActions(deps),
    ...createLogisticsSecondaryDeliveryActions(deps),
  };
}
