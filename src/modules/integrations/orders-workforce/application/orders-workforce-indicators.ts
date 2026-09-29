export type OperationalOccupancy = 'AVAILABLE' | 'OCCUPIED' | 'BLOCKED' | 'OUT_OF_SCHEDULE';

export interface OperationalPersonIndicator {
  readonly profileId: string;
  readonly name: string;
  readonly occupancy: OperationalOccupancy;
  readonly orderId: string | null;
  readonly orderNumber: string | null;
  readonly activityTitle: string | null;
  readonly activeBusinessMinutes: number;
  readonly blockedBusinessMinutes: number;
  readonly completedActivities: number;
  readonly inactivityMinutes: number | null;
  readonly excludedFromOccupancyMetrics: boolean;
  readonly excludedFromTimeMetrics: boolean;
}

export interface OperationalOrderIndicator {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly stepCode: string;
  readonly responsibleProfileId: string | null;
  readonly responsibleName: string | null;
  readonly sellerProfileId: string;
  readonly sellerName: string;
  readonly workforceActivityId: string | null;
  readonly workforceStatus: string | null;
  readonly businessMinutes: number;
}

export interface OrdersWorkforceIndicatorSnapshot {
  readonly activeActivities: number;
  readonly occupiedPeople: number;
  readonly availablePeople: number;
  readonly blockedActivities: number;
  readonly operationalOrders: number;
  readonly completedActivities: number;
  readonly averageActivityMinutes: number;
  readonly averageMinutesByStep: Readonly<Record<string, number>>;
  readonly ordersByStep: Readonly<Record<string, number>>;
  readonly people: readonly OperationalPersonIndicator[];
  readonly orders: readonly OperationalOrderIndicator[];
}

export interface OrdersWorkforceIndicatorsPort {
  snapshot(from?: string, to?: string): Promise<OrdersWorkforceIndicatorSnapshot>;
}
