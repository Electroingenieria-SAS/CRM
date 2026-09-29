import type {
  AnalyticsFilters,
  HistoricalImportInput,
  ReportResponse,
} from '@/modules/analytics/application/analytics.schemas';
import { parseCsv, recordsToCsv, sha256Hex } from '@/modules/analytics/domain/csv';
import type { AnalyticsRepository } from '@/modules/analytics/ports/analytics-repository';

const historicalHeaders = [
  'externalKey',
  'externalOrderKey',
  'orderNumber',
  'clientName',
  'sellerReference',
  'routeCode',
  'stepCode',
  'taskCreatedAt',
  'startedAt',
  'completedAt',
  'waitingSeconds',
  'processingSeconds',
  'blockedSeconds',
  'transitSeconds',
] as const;

function cleanFilters(filters: AnalyticsFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  ) as AnalyticsFilters;
}

export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  kpis() {
    return this.repository.kpis();
  }

  dashboard(filters: AnalyticsFilters = {}) {
    return this.repository.dashboard(cleanFilters(filters));
  }

  vsmSummary(filters: AnalyticsFilters = {}) {
    return this.repository.vsmSummary(cleanFilters(filters));
  }

  orderVsm(orderId?: string, externalOrderKey?: string) {
    if (!orderId && !externalOrderKey?.trim()) {
      throw new Error('Indica un pedido operativo o una clave histórica.');
    }
    return this.repository.orderVsm(orderId, externalOrderKey?.trim());
  }

  reportCatalog() {
    return this.repository.reportCatalog();
  }

  report(report: string, filters: AnalyticsFilters & { search?: string }, page = 1, pageSize = 25) {
    if (!report.trim()) throw new Error('Selecciona un reporte.');
    return this.repository.report(report, cleanFilters(filters), page, Math.min(pageSize, 100));
  }

  async exportPage(
    report: string,
    filters: AnalyticsFilters & { search?: string },
    response: ReportResponse,
  ) {
    const csv = recordsToCsv(response.columns, response.rows);
    const exportFilters = Object.fromEntries(Object.entries(cleanFilters(filters))) as Record<
      string,
      unknown
    >;
    await this.repository.recordExport(report, exportFilters, 'CSV', response.rows.length);
    return csv;
  }

  async prepareHistoricalCsv(fileName: string, text: string, source: string) {
    if (!fileName.toLowerCase().endsWith('.csv')) throw new Error('La importación requiere CSV.');
    if (!source.trim()) throw new Error('Indica la fuente del histórico.');

    const rows = parseCsv(text);
    if (rows.length > 2000) throw new Error('El archivo supera el límite de 2.000 filas.');

    const firstRow = rows[0];
    if (!firstRow) throw new Error('El CSV no contiene filas de datos.');
    const missing = historicalHeaders.filter((header) => !(header in firstRow));
    if (missing.length) {
      throw new Error('Faltan columnas: ' + missing.join(', ') + '.');
    }

    const input: HistoricalImportInput = {
      importType: 'ORDER_STAGE_HISTORY_V1',
      fileName,
      checksumSha256: await sha256Hex(text),
      fileSizeBytes: new TextEncoder().encode(text).byteLength,
      source: source.trim(),
      rows,
    };
    return this.repository.previewImport(input);
  }

  applyImport(batchId: string) {
    return this.repository.applyImport(batchId);
  }

  imports(page = 1, pageSize = 25) {
    return this.repository.imports(page, Math.min(pageSize, 100));
  }
}
