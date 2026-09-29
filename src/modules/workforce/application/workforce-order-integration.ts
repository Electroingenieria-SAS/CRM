export interface OrderWorkforceActivityRequested {
  readonly eventId: string;
  readonly orderId: string;
  readonly orderTaskId: string;
  readonly catalogCode: string;
  readonly plannedStart: string;
  readonly plannedEnd: string;
  readonly assigneeProfileId?: string;
  readonly title?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface WorkforceOrderIntegrationPort {
  planFromOrderEvent(event: OrderWorkforceActivityRequested): Promise<{
    readonly activityId: string;
    readonly idempotent: boolean;
  }>;
}
