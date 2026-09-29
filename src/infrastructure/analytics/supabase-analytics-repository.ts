import type { SupabaseClient } from '@supabase/supabase-js';
import {
  analyticsDashboardSchema,
  analyticsOrderVsmSchema,
  analyticsVsmSummarySchema,
  importApplySchema,
  importListSchema,
  importPreviewSchema,
  kpiCatalogSchema,
  reportCatalogSchema,
  reportResponseSchema,
  type AnalyticsFilters,
  type HistoricalImportInput,
} from '@/modules/analytics/application/analytics.schemas';
import type { AnalyticsRepository } from '@/modules/analytics/ports/analytics-repository';
import { AppError } from '@/shared/errors/app-error';

function repositoryError(error: { code?: string } | null, operation: string) {
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', 'No tienes permisos para consultar esta analítica.');
  }
  if (error?.code === '22023' || error?.code === 'P0002') {
    return new AppError('BUSINESS_RULE', 'Los filtros o datos solicitados no son válidos.');
  }
  return new AppError('DATABASE', 'No fue posible completar ' + operation + '.');
}

export class SupabaseAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async kpis() {
    const { data, error } = await this.client.rpc('erp_x_analytics_kpis');
    if (error) throw repositoryError(error, 'la consulta del catálogo de KPIs');
    return kpiCatalogSchema.parse(data);
  }

  async dashboard(filters: AnalyticsFilters = {}) {
    const { data, error } = await this.client.rpc('erp_x_analytics_dashboard', {
      p_from: filters.from ?? null,
      p_to: filters.to ?? null,
      p_client: filters.client ?? null,
      p_seller_id: filters.sellerId ?? null,
      p_responsible_id: filters.responsibleId ?? null,
      p_step: filters.step ?? null,
      p_status: filters.status ?? null,
      p_route: filters.route ?? null,
      p_segment: filters.segment ?? null,
    });
    if (error) throw repositoryError(error, 'la carga del dashboard');
    return analyticsDashboardSchema.parse(data);
  }

  async vsmSummary(filters: AnalyticsFilters = {}) {
    const { data, error } = await this.client.rpc('erp_x_analytics_vsm_summary', {
      p_from: filters.from ?? null,
      p_to: filters.to ?? null,
      p_client: filters.client ?? null,
      p_seller_id: filters.sellerId ?? null,
      p_step: filters.step ?? null,
      p_status: filters.status ?? null,
      p_route: filters.route ?? null,
      p_source: filters.source ?? null,
    });
    if (error) throw repositoryError(error, 'la consulta VSM');
    return analyticsVsmSummarySchema.parse(data);
  }

  async orderVsm(orderId?: string, externalOrderKey?: string) {
    const { data, error } = await this.client.rpc('erp_x_analytics_order_vsm', {
      p_order_id: orderId ?? null,
      p_external_order_key: externalOrderKey ?? null,
    });
    if (error) throw repositoryError(error, 'la trazabilidad VSM del pedido');
    return analyticsOrderVsmSchema.parse(data);
  }

  async reportCatalog() {
    const { data, error } = await this.client.rpc('erp_x_analytics_report_catalog');
    if (error) throw repositoryError(error, 'la consulta del catálogo de reportes');
    return reportCatalogSchema.parse(data);
  }

  async report(
    report: string,
    filters: AnalyticsFilters & { search?: string },
    page: number,
    pageSize: number,
  ) {
    const { data, error } = await this.client.rpc('erp_x_analytics_report', {
      p_report: report,
      p_filters: filters,
      p_page: page,
      p_page_size: pageSize,
    });
    if (error) throw repositoryError(error, 'la consulta del reporte');
    return reportResponseSchema.parse(data);
  }

  async recordExport(
    report: string,
    filters: Record<string, unknown>,
    format: 'CSV',
    rowCount: number,
  ) {
    const { error } = await this.client.rpc('erp_x_analytics_record_export', {
      p_report: report,
      p_filters: filters,
      p_format: format,
      p_row_count: rowCount,
    });
    if (error) throw repositoryError(error, 'el registro de exportación');
  }

  async previewImport(input: HistoricalImportInput) {
    const { data, error } = await this.client.rpc('erp_x_analytics_import_preview', {
      p_import_type: input.importType,
      p_file_name: input.fileName,
      p_checksum_sha256: input.checksumSha256,
      p_file_size_bytes: input.fileSizeBytes,
      p_source: input.source,
      p_rows: input.rows,
    });
    if (error) throw repositoryError(error, 'la validación de importación');
    return importPreviewSchema.parse(data);
  }

  async applyImport(batchId: string) {
    const { data, error } = await this.client.rpc('erp_x_analytics_import_apply', {
      p_batch_id: batchId,
    });
    if (error) throw repositoryError(error, 'la aplicación de importación');
    return importApplySchema.parse(data);
  }

  async imports(page = 1, pageSize = 25) {
    const { data, error } = await this.client.rpc('erp_x_analytics_imports', {
      p_page: page,
      p_page_size: pageSize,
    });
    if (error) throw repositoryError(error, 'la consulta del historial de importaciones');
    return importListSchema.parse(data);
  }
}
