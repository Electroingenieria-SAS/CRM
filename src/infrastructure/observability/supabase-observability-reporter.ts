import type { SupabaseClient } from '@supabase/supabase-js';

export interface TelemetryPayload {
  level: 'warn' | 'error';
  event: string;
  correlationId?: string;
  module?: string;
  durationMs?: number;
  context?: Record<string, unknown>;
}

export class SupabaseObservabilityReporter {
  constructor(private readonly client: SupabaseClient) {}

  async report(payload: TelemetryPayload) {
    await this.client.rpc('erp_x_observability_record', {
      p_level: payload.level.toUpperCase(),
      p_event: payload.event,
      p_module: payload.module ?? null,
      p_correlation_id: payload.correlationId ?? null,
      p_duration_ms: payload.durationMs ?? null,
      p_context: payload.context ?? {},
    });
  }
}
