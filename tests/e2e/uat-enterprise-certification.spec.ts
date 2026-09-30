import { expect, test, type Page } from '@playwright/test';

const sellerEmail = 'qa-seller@example.test';
const auditorEmail = 'qa-auditor@example.test';
const coordinatorEmail = 'qa-coordinator-a@example.test';
const superAdminEmail = 'qa-superadmin@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for UAT.');
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

interface OrderScenario {
  code: 'PVC' | 'PVN' | 'PVE' | 'PVP';
  payment: 'CASH' | 'CREDIT' | 'MIXED';
  route: 'CLIENT_POINT' | 'CLIENT_PICKUP' | 'LOCAL_DISPATCH' | 'NATIONAL_DISPATCH';
  requiresPurchase?: boolean;
}

async function createOrder(page: Page, scenario: OrderScenario, suffix: string) {
  const orderNumber = `UAT14-${scenario.code}-${suffix}`;
  await page.getByRole('button', { name: 'Crear pedido' }).click();
  await page.getByLabel('Número de pedido *').fill(orderNumber);
  await page.getByLabel('Cliente *').fill('Cliente Sintético Premium');
  await page.getByLabel('NIT o documento').fill('900002');
  await page.getByLabel('Tipo *').selectOption(scenario.code);
  await page.getByLabel('Condición de pago *').selectOption(scenario.payment);
  await page.getByLabel('Modalidad de entrega *').selectOption(scenario.route);
  await page.getByLabel('Departamento').fill('Valle del Cauca');
  await page.getByLabel('Ciudad *').fill('Cali');
  await page.getByLabel('Dirección de entrega *').fill('Calle UAT 14 # 10-20');
  if (scenario.requiresPurchase) {
    await page.getByLabel('Requiere compra o abastecimiento').check();
  }
  await page.getByLabel('Descripción *').fill(`Material UAT ${scenario.code}`);
  await page.getByLabel('Cantidad *').fill('2');
  await page.getByRole('button', { name: 'Crear pedido', exact: true }).last().click();

  await expect(page.getByRole('status')).toContainText(
    `Pedido ${orderNumber} creado correctamente.`,
  );
  const order = page.getByRole('button', { name: new RegExp(orderNumber) });
  await expect(order).toBeVisible();
  await expect(order).toContainText(scenario.route);
  await expect(order).toContainText('HIGH');
  return orderNumber;
}

test('UAT14-ORDERS: sales can register representative PVC, PVN, PVE and PVP journeys', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Enterprise UAT runs once.');

  await login(page, sellerEmail);
  const suffix = `${testInfo.retry}-${Date.now()}`;

  const scenarios: OrderScenario[] = [
    { code: 'PVC', payment: 'CASH', route: 'CLIENT_POINT' },
    { code: 'PVN', payment: 'CASH', route: 'NATIONAL_DISPATCH' },
    { code: 'PVE', payment: 'CASH', route: 'LOCAL_DISPATCH', requiresPurchase: true },
    { code: 'PVP', payment: 'CREDIT', route: 'CLIENT_PICKUP' },
  ];

  for (const scenario of scenarios) {
    await createOrder(page, scenario, suffix);
  }

  await page.getByLabel('Buscar').fill(`UAT14-PVE-${suffix}`);
  await page.getByRole('button', { name: 'Buscar' }).click();
  const pve = page.getByRole('button', { name: new RegExp(`UAT14-PVE-${suffix}`) });
  await expect(pve).toBeVisible();
  await pve.click();
  await expect(page.getByRole('heading', { level: 2, name: `UAT14-PVE-${suffix}` })).toBeVisible();
  await expect(page.getByText('Material UAT PVE')).toBeVisible();
});

test('UAT14-RBAC: enterprise roles expose only their operational surfaces', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Enterprise role UAT runs once.');

  await login(page, sellerEmail);
  await expect(page.getByRole('button', { name: 'Crear pedido' })).toBeVisible();
  await logout(page);

  await login(page, auditorEmail);
  await expect(page.getByRole('button', { name: 'Crear pedido' })).toHaveCount(0);
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Auditoría del sistema' })).toBeVisible();
  await logout(page);

  await login(page, coordinatorEmail);
  await page.goto('/workforce');
  await expect(page.getByRole('heading', { name: 'Jornada y cronograma' })).toBeVisible();
  await page.goto('/logistics');
  await expect(page.getByRole('heading', { name: 'Logística y entrega' })).toBeVisible();
  await logout(page);

  await login(page, superAdminEmail);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Usuarios y perfiles' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir PACO' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir PACO' }).click();
  await expect(page.getByLabel('PACO asistente operativo')).toBeVisible();
});

test('UAT14-ANALYTICS: management surface reflects operational synthetic data', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Enterprise analytics UAT runs once.');

  await login(page, superAdminEmail);
  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Qué está pasando ahora' })).toBeVisible();
  await page.getByLabel('Desde').fill('2026-09-29');
  await page.getByLabel('Hasta').fill('2026-09-29');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByText('AN-E2E-BLOCKED')).toBeVisible();

  await page.getByRole('link', { name: 'VSM' }).click();
  await expect(page.getByRole('heading', { name: 'Tiempos y cuellos de botella' })).toBeVisible();

  await page.getByRole('button', { name: 'Abrir PACO' }).click();
  await page.getByRole('button', { name: 'Resumen ahora' }).click();
  await expect(page.getByText(/Resumen:/).last()).toBeVisible();
});
