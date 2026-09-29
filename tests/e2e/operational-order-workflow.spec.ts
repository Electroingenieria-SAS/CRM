import { expect, test, type Page } from '@playwright/test';

const sellerEmail = 'qa-seller@example.test';
const coordinatorEmail = 'qa-coordinator-a@example.test';
const auxiliaryEmail = 'qa-aux-logistica@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for workflow tests.');
  return value;
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password());
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/);
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login\/?$/);
}

test('order workflow records claim start block resume and completion', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The workflow journey mutates one synthetic order once per CI run.',
  );

  await login(page, sellerEmail);
  const orderNumber = `WF-${Date.now()}`;

  await page.getByRole('button', { name: 'Crear pedido' }).click();
  await page.getByLabel('Número de pedido *').fill(orderNumber);
  await page.getByLabel('Cliente *').fill('Cliente Workflow QA');
  await page.getByLabel('Ciudad *').fill('Cali');
  await page.getByLabel('Dirección de entrega *').fill('Calle Workflow 1 # 2-3');
  await page.getByLabel('Descripción *').fill('Material workflow');
  await page.getByLabel('Cantidad *').fill('1');
  await page.getByRole('button', { name: 'Crear pedido', exact: true }).last().click();
  await expect(page.getByRole('status')).toContainText(
    `Pedido ${orderNumber} creado correctamente.`,
  );
  await logout(page);

  await login(page, coordinatorEmail);
  await page.getByLabel('Buscar').fill(orderNumber);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('button', { name: new RegExp(orderNumber) }).click();

  await expect(page.getByRole('heading', { name: 'Gestión de la tarea activa' })).toBeVisible();
  await page.getByRole('button', { name: 'Tomar tarea' }).click();
  await expect(page.getByRole('status')).toContainText('Tarea tomada correctamente.');

  await page.getByRole('button', { name: 'Iniciar trabajo' }).click();
  await expect(page.getByRole('status')).toContainText('Trabajo iniciado.');

  await page.getByText('Bloquear tarea').click();
  await page.getByLabel('Observación').fill('Información incompleta para continuar');
  await page.getByRole('button', { name: 'Registrar bloqueo' }).click();
  await expect(page.getByRole('status')).toContainText('Bloqueo registrado.');

  await page.getByText('Resolver bloqueo y reanudar').click();
  await page.getByLabel('Resolución').fill('Información confirmada y validada');
  await page.getByRole('button', { name: 'Resolver y reanudar' }).click();
  await expect(page.getByRole('status')).toContainText('Bloqueo resuelto y trabajo reanudado.');

  await page.getByRole('button', { name: 'Completar etapa' }).click();
  await expect(page.getByRole('status')).toContainText('Etapa completada y workflow actualizado.');

  await expect(page.getByText('ALISTAMIENTO').first()).toBeVisible();
  await expect(page.getByText('ORDER_TASK_CLAIMED')).toBeVisible();
  await expect(page.getByText('ORDER_TASK_STARTED')).toBeVisible();
  await expect(page.getByText('ORDER_BLOCKED')).toBeVisible();
  await expect(page.getByText('ORDER_BLOCK_RESOLVED')).toBeVisible();
  await expect(page.getByText('ORDER_TASK_COMPLETED')).toBeVisible();

  await logout(page);
  await login(page, auxiliaryEmail);
  await page.getByLabel('Buscar').fill(orderNumber);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('button', { name: new RegExp(orderNumber) }).click();

  await page.getByRole('button', { name: 'Tomar tarea' }).click();
  await expect(page.getByRole('status')).toContainText('Tarea tomada correctamente.');

  await page.goto('/operations/orders-workforce');
  const plannedOrder = page.getByRole('row').filter({ hasText: orderNumber });
  await expect(plannedOrder).toContainText('QA Auxiliar Logística');
  await expect(plannedOrder).toContainText('PLANNED');

  await page.goto('/orders');
  await page.getByLabel('Buscar').fill(orderNumber);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('button', { name: new RegExp(orderNumber) }).click();
  await page.getByRole('button', { name: 'Iniciar trabajo' }).click();
  await expect(page.getByRole('status')).toContainText('Trabajo iniciado.');

  await page.goto('/operations/orders-workforce');
  const activeOrder = page.getByRole('row').filter({ hasText: orderNumber });
  await expect(activeOrder).toContainText('IN_PROGRESS');
  const auxiliaryRow = page.getByRole('row', {
    name: /QA Auxiliar Logística (OCCUPIED|OUT OF SCHEDULE)/,
  });
  await expect(auxiliaryRow).toBeVisible();

  await page.goto('/orders');
  await page.getByLabel('Buscar').fill(orderNumber);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('button', { name: new RegExp(orderNumber) }).click();
  await page.getByRole('button', { name: 'Completar etapa' }).click();
  await expect(page.getByRole('status')).toContainText('Etapa completada y workflow actualizado.');
  await expect(page.getByText('FACTURACION').first()).toBeVisible();

  await page.goto('/operations/orders-workforce');
  const completedCard = page.getByText('Actividades finalizadas').locator('..');
  await expect(completedCard.getByText('1', { exact: true })).toBeVisible();
});
