import type {
  AnalyticsDashboard,
  AnalyticsFilters,
  AnalyticsOrderVsm,
  AnalyticsVsmSummary,
  HistoricalImportInput,
  ImportApply,
  ImportList,
  ImportPreview,
  KpiCatalog,
  ReportCatalog,
  ReportResponse,
} from '@/modules/analytics/application/analytics.schemas';

export interface AnalyticsRepository {
  kpis(): Promise<KpiCatalog>;
  dashboard(filters?: AnalyticsFilters): Promise<AnalyticsDashboard>;
  vsmSummary(filters?: AnalyticsFilters): Promise<AnalyticsVsmSummary>;
  orderVsm(orderId?: string, externalOrderKey?: string): Promise<AnalyticsOrderVsm>;
  reportCatalog(): Promise<ReportCatalog>;
  report(
    report: string,
    filters: AnalyticsFilters & { search?: string },
    page: number,
    pageSize: number,
  ): Promise<ReportResponse>;
  recordExport(
    report: string,
    filters: Record<string, unknown>,
    format: 'CSV',
    rowCount: number,
  ): Promise<void>;
  previewImport(input: HistoricalImportInput): Promise<ImportPreview>;
  applyImport(batchId: string): Promise<ImportApply>;
  imports(page?: number, pageSize?: number): Promise<ImportList>;
}
