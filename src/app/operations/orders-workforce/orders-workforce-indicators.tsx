'use client';

import type { OrdersWorkforceIndicatorSnapshot } from '@/modules/integrations/orders-workforce/application/orders-workforce-indicators';
import styles from './orders-workforce-page.module.css';

export function OrdersWorkforceIndicators({
  snapshot,
}: {
  snapshot: OrdersWorkforceIndicatorSnapshot;
}) {
  const summary = [
    ['Actividades activas', snapshot.activeActivities],
    ['Personas ocupadas', snapshot.occupiedPeople],
    ['Personas disponibles', snapshot.availablePeople],
    ['Actividades bloqueadas', snapshot.blockedActivities],
    ['Pedidos en operación', snapshot.operationalOrders],
    ['Actividades finalizadas', snapshot.completedActivities],
  ] as const;

  return (
    <>
      <section className={styles.metrics} aria-label="Indicadores operativos">
        {summary.map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className={styles.panel} aria-labelledby="orders-operation-title">
        <div className={styles.panelHeader}>
          <div>
            <h2 id="orders-operation-title">Pedidos en operación</h2>
            <p>
              Responsable operativo y vendedor se mantienen separados; los tiempos excluyen
              bloqueos y respetan la jornada.
            </p>
          </div>
          <span>Promedio: {snapshot.averageActivityMinutes.toFixed(1)} min</span>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Etapa</th>
                <th>Responsable</th>
                <th>Vendedor</th>
                <th>Workforce</th>
                <th>Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.orders.map((order) => (
                <tr key={order.orderId}>
                  <td>{order.orderNumber}</td>
                  <td>{order.stepCode.replaceAll('_', ' ')}</td>
                  <td>{order.responsibleName ?? 'Sin asignar'}</td>
                  <td>{order.sellerName}</td>
                  <td>{order.workforceStatus ?? 'Sin actividad'}</td>
                  <td>{order.businessMinutes.toFixed(1)} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="people-operation-title">
        <div className={styles.panelHeader}>
          <div>
            <h2 id="people-operation-title">Ocupación por persona</h2>
            <p>Métricas objetivas; no se generan rankings de “mejor” o “peor” empleado.</p>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Estado</th>
                <th>Actividad</th>
                <th>Activo</th>
                <th>Bloqueado</th>
                <th>Inactividad</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.people.map((person) => (
                <tr key={person.profileId}>
                  <td>{person.name}</td>
                  <td>{person.occupancy.replaceAll('_', ' ')}</td>
                  <td>{person.activityTitle ?? 'Sin actividad'}</td>
                  <td>{person.activeBusinessMinutes.toFixed(1)} min</td>
                  <td>{person.blockedBusinessMinutes.toFixed(1)} min</td>
                  <td>
                    {person.inactivityMinutes === null
                      ? 'No aplica'
                      : `${person.inactivityMinutes.toFixed(1)} min`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
