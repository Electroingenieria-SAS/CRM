import type { OrdersService } from '@/modules/orders/application/orders-service';
import type { OrderWorkflowService } from '@/modules/orders/application/order-workflow-service';
import type {
  LogisticsEvidencePort,
  LogisticsOrdersPort,
} from '@/modules/logistics/ports/logistics-ports';

export class OrdersLogisticsAdapter implements LogisticsOrdersPort, LogisticsEvidencePort {
  constructor(
    private readonly orders: OrdersService,
    private readonly workflow: OrderWorkflowService,
  ) {}

  async ensureOperationalStarted(orderId: string, key: string) {
    const detail = await this.orders.get(orderId);
    if (detail.workflow.blockingIssueOpen) {
      throw new Error('La tarea logística está bloqueada y no puede continuar.');
    }

    const actions = new Map(detail.workflow.actions.map((action) => [action.code, action]));
    let version = detail.order.version;

    if (actions.get('RESUME')?.enabled) {
      await this.workflow.resume(
        orderId,
        'Gestión logística retomada para continuar el despacho o la entrega.',
        version,
        `${key}:resume`,
      );
      return;
    }

    if (actions.get('CLAIM')?.enabled) {
      const claimed = await this.workflow.claim(orderId, version, `${key}:claim`);
      version = claimed.version ?? version;
      await this.workflow.start(orderId, version, `${key}:start`);
      return;
    }

    if (actions.get('START')?.enabled) {
      await this.workflow.start(orderId, version, `${key}:start`);
      return;
    }

    if (actions.get('COMPLETE')?.enabled) return;

    const refreshed = await this.orders.get(orderId);
    if (!refreshed.workflow.actions.some((action) => action.code === 'COMPLETE' && action.enabled)) {
      throw new Error('La tarea logística debe estar iniciada antes de continuar.');
    }
  }

  async completeDelivery(orderId: string, key: string) {
    const detail = await this.orders.get(orderId);
    const routeSteps = ['CLIENT_POINT', 'CLIENT_PICKUP', 'LOCAL_DISPATCH', 'NATIONAL_DISPATCH'];
    if (!routeSteps.includes(detail.order.current_step_code)) return;

    await this.workflow.complete(
      orderId,
      'DELIVERED',
      'Entrega logística confirmada.',
      detail.order.version,
      key,
    );
  }

  async add(
    orderId: string,
    evidenceType: string,
    storageProvider: string,
    storageReference: string,
    fileName: string | undefined,
    mimeType: string | undefined,
    key: string,
  ) {
    const result = await this.workflow.addEvidence(
      orderId,
      {
        evidenceType,
        storageProvider,
        storageReference,
        fileName,
        mimeType,
        metadata: { source: 'LOGISTICS' },
      },
      key,
    );
    return result.evidenceId;
  }
}
