import type {
  AssistantAlert,
} from '@/modules/assistant/application/assistant.schemas';

export interface AssistantRepository {
  rateLimit(operation: string): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  alerts(refresh?: boolean): Promise<AssistantAlert[]>;
  acknowledgeAlert(alertId: string): Promise<void>;
  recordAction(
    action: string,
    resourceType: string,
    resourceId: string | null,
    result: 'SUCCESS' | 'FAILED' | 'DENIED' | 'REQUESTED' | 'ACKNOWLEDGED',
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}
