import type { AnalyticsService } from '@/modules/analytics/application/analytics-service';
import type {
  PacoActivityDraft,
  PacoReply,
} from '@/modules/assistant/application/assistant.schemas';
import type { AssistantRepository } from '@/modules/assistant/ports/assistant-repository';
import {
  classifyPacoIntent,
  extractOrderReference,
} from '@/modules/assistant/domain/spanish-intent';
import type { OrdersService } from '@/modules/orders/application/orders-service';
import type { WorkforceService } from '@/modules/workforce/application/workforce-service';

function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function numeric(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];
  return typeof value === 'number' ? value : 0;
}

export class PacoService {
  constructor(
    private readonly repository: AssistantRepository,
    private readonly orders: OrdersService,
    private readonly workforce: WorkforceService,
    private readonly analytics: AnalyticsService,
  ) {}

  alerts(refresh = true) {
    return this.repository.alerts(refresh);
  }

  acknowledgeAlert(alertId: string) {
    return this.repository.acknowledgeAlert(alertId);
  }

  async ask(message: string): Promise<PacoReply> {
    const limit = await this.repository.rateLimit('message');
    if (!limit.allowed) {
      return {
        text: `Has hecho varias consultas seguidas. Intenta nuevamente en ${limit.retryAfterSeconds} segundos.`,
        action: 'NONE',
      };
    }

    const match = classifyPacoIntent(message);

    switch (match.intent) {
      case 'CANCEL':
        return { text: 'Consulta cancelada. ¿Qué necesitas ahora?', action: 'CANCEL' };
      case 'HELP':
        return this.help();
      case 'CREATE_ACTIVITY':
        return {
          text: 'Te guío para registrar la actividad. Primero selecciona el tipo y la categoría.',
          action: 'START_ACTIVITY_WIZARD',
        };
      case 'OPEN_MODULE':
        return {
          text: 'Abriendo el módulo solicitado.',
          action: 'NAVIGATE',
          href: match.modulePath ?? '/orders',
        };
      case 'ORDER_LOOKUP':
        return this.orderLookup(match.reference ?? extractOrderReference(message));
      case 'QUEUE':
        return this.queue();
      case 'OCCUPANCY':
        return this.occupancy();
      case 'SUMMARY':
        return this.summary();
      default:
        return {
          text: 'No estoy seguro de esa solicitud. Puedo consultar pedidos, colas, ocupación, pendientes, registrar actividades o abrir módulos.',
          action: 'NONE',
          suggestions: [
            'Resumen ahora',
            'Ver cola',
            'Registrar actividad',
            'Quién está disponible',
          ],
        };
    }
  }

  async activitySetup() {
    const day = todayBogota();
    const [catalog, schedule] = await Promise.all([
      this.workforce.catalog(),
      this.workforce.schedule(day, day),
    ]);
    return { catalog: catalog.items, people: schedule.people };
  }

  async resolveOrder(reference: string) {
    const query = reference.trim();
    if (!query) return null;
    const result = await this.orders.list({
      search: query,
      page: 1,
      pageSize: 10,
      includeHistory: true,
    });
    return (
      result.items.find((order) => order.orderNumber.toLowerCase() === query.toLowerCase()) ??
      result.items[0] ??
      null
    );
  }

  async createActivity(draft: PacoActivityDraft) {
    const limit = await this.repository.rateLimit('activity_create');
    if (!limit.allowed) throw new Error('Demasiadas actividades registradas en un minuto.');

    try {
      const result = await this.workforce.create(
        {
          catalogId: draft.catalogId,
          assigneeProfileId: draft.assigneeProfileId,
          title: draft.title,
          plannedStart: draft.plannedStart,
          plannedEnd: draft.plannedEnd,
          orderId: draft.orderId,
          metadata: { channel: 'PACO' },
        },
        crypto.randomUUID(),
      );
      await this.repository.recordAction(
        'ACTIVITY_CREATED',
        'workforce_activity',
        result.activityId,
        'SUCCESS',
        { orderId: draft.orderId ?? null },
      );
      return result;
    } catch (error) {
      await this.repository.recordAction(
        'ACTIVITY_CREATE_FAILED',
        'workforce_activity',
        null,
        'FAILED',
        { orderId: draft.orderId ?? null },
      );
      throw error;
    }
  }

  private async orderLookup(reference?: string): Promise<PacoReply> {
    if (!reference) {
      return {
        text: 'Indícame el número o referencia del pedido que quieres consultar.',
        action: 'NONE',
      };
    }
    const order = await this.resolveOrder(reference);
    if (!order) {
      return { text: `No encontré un pedido que coincida con ${reference}.`, action: 'NONE' };
    }
    return {
      text:
        `Pedido ${order.orderNumber}: ${order.clientName}. ` +
        `Está en ${order.stepName}, estado ${order.status}.`,
      action: 'NONE',
      suggestions: ['Abrir pedidos', 'Resumen ahora'],
    };
  }

  private async queue(): Promise<PacoReply> {
    const dashboard = await this.analytics.dashboard();
    const rows = dashboard.ordersByStep
      .filter((row) => row.count > 0)
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
    if (!rows.length) return { text: 'No hay pedidos activos en cola ahora.', action: 'NONE' };

    return {
      text:
        'Cola actual: ' +
        rows.map((row) => `${row.name}: ${row.count} (${row.blocked} bloqueados)`).join(' · '),
      action: 'NONE',
      suggestions: ['Resumen ahora', 'Abrir panel'],
    };
  }

  private async occupancy(): Promise<PacoReply> {
    const dashboard = await this.analytics.dashboard();
    const workforce = dashboard.workforce;
    if (!dashboard.sources.workforce || !workforce) {
      return { text: 'Workforce no está disponible para tu perfil.', action: 'NONE' };
    }

    return {
      text:
        `Ocupadas: ${numeric(workforce, 'occupiedPeople')}. ` +
        `Disponibles: ${numeric(workforce, 'availablePeople')}. ` +
        `Actividades activas: ${numeric(workforce, 'activeActivities')}. ` +
        `Bloqueadas: ${numeric(workforce, 'blockedActivities')}.`,
      action: 'NONE',
      suggestions: ['Abrir jornada', 'Registrar actividad'],
    };
  }

  private async summary(): Promise<PacoReply> {
    const dashboard = await this.analytics.dashboard();
    const alerts = await this.repository.alerts(true);
    const critical = alerts.filter((alert) => alert.status === 'OPEN').slice(0, 3);

    return {
      text:
        `Resumen: ${dashboard.summary.ordersActive} pedidos activos, ` +
        `${dashboard.summary.ordersBlocked} bloqueados, ` +
        `${dashboard.summary.financialPending} pendientes financieros y ` +
        `${dashboard.summary.deliveriesPending} pendientes de entrega.` +
        (critical.length ? ` Alertas: ${critical.map((alert) => alert.message).join(' ')}` : ''),
      action: 'NONE',
      suggestions: ['Ver cola', 'Quién está disponible', 'Abrir panel'],
    };
  }

  private help(): PacoReply {
    return {
      text: 'Puedo consultar pedidos y colas, mostrar ocupación y pendientes, registrar actividades guiadas, mostrar alertas y abrir módulos.',
      action: 'NONE',
      suggestions: ['Resumen ahora', 'Consultar pedido', 'Registrar actividad', 'Ver ocupación'],
    };
  }
}
