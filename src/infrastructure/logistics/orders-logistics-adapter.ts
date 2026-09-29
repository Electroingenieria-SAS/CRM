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

    if (detail.order.status === 'IN_PROGRESS') return;
    if (detail.order.status === 'BLOCKED' || detail.workflow.blockingIssueOpen) {
      throw new Error('La tarea logística está bloqueada y no puede continuar.');
    }

    const actions = new Map(detail.workflow.actions.map((action) => [action.code, action]));
    let version = detail.order.version;

    if (actions.get('CLAIM')?.enabled) {
      const claimed = await this.workflow.claim(orderId, version, `${key}:claim`);
      version = claimed.version ?? version;
    }

    if (actions.get('RESUME')?.enabled) {
      await this.workflow.resume(
        orderId,
        'Gestión logística retomada para continuar el despacho o la entrega.',
        version,
        `${key}:resume`,
      );
      return;
    }

    if (actions.get('START')?.enabled || actions.get('CLAIM')?.enabled) {
      await this.workflow.start(orderId, version, `${key}:start`);
      return;
    }

    const refreshed = await this.orders.get(orderId);
    if (refreshed.order.status !== 'IN_PROGRESS') {
      throw new Error('La tarea logística debe estar iniciada antes de continuar.');
    }
  }

  async completeDelivery(orderId: string, key: string) {
    const detail = await this.orders.get(orderId);
    if (
      !['CLIENT_POINT', 'CLIENT_PICKUP', 'LOCAL_DISPATCH', 'NATIONAL_DISPATCH'].includes(
        detail.order.current_step_code,
      )
    ) {
      return;
    }

    const complete = detail.workflow.actions.find(
      (action) => action.code === 'COMPLETE' && action.enabled,
    );
    if (!complete) {
      throw new Error('Orders no habilita el cierre de la etapa logística.');
    }

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
