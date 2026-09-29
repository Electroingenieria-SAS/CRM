import { expect, test, type Page } from '@playwright/test';

const orderNumber = 'LOG-E2E-BILLING';
const cajaEmail = 'qa-caja-a@example.test';
const coordinatorEmail = 'qa-coordinator-a@example.test';
const auditorEmail = 'qa-auditor@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for authenticated tests.');
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

async function selectOrderIfPresent(page: Page) {
  const order = page.getByRole('button').filter({ hasText: orderNumber }).first();
  if ((await order.count()) === 0) return false;
  await order.click();
  return true;
}

async function ensureInvoice(page: Page, retry: number) {
  await page.goto('/billing');
  await page.getByLabel('Buscar pedido o cliente').fill(orderNumber);
  await page.getByRole('button', { name: 'Buscar' }).click();
  if (!(await selectOrderIfPresent(page))) return;

  if ((await page.getByText('Facturación lista').count()) > 0) return;

  await page.getByLabel('Número de factura').fill(`LOG-E2E-FAC-${retry}`);
  await page.getByLabel('Valor registrado').fill('250000');
  await page.getByRole('button', { name: 'Registrar factura' }).click();
  await expect(page.getByText('Factura registrada correctamente.')).toBeVisible();
}

async function advanceBillingIfPresent(page: Page) {
  await page.goto('/billing');
  await page.getByLabel('Buscar pedido o cliente').fill(orderNumber);
  await page.getByRole('button', { name: 'Buscar' }).click();
  if (!(await selectOrderIfPresent(page))) return;

  await expect(page.getByText('Facturación lista')).toBeVisible();
  await page.getByRole('button', { name: 'Liberar hacia logística' }).click();
  await expect(page.getByText('Pedido liberado hacia logística.')).toBeVisible();
}

async function releaseShipmentIfPending(page: Page) {
  await page.goto('/logistics');
  await page.getByLabel('Buscar candidatos').fill(orderNumber);
  await page.getByRole('button', { name: 'Buscar' }).first().click();

  const releaseSection = page
    .getByRole('heading', { name: 'Por liberar' })
    .locator('xpath=ancestor::section[1]');
  const candidate = releaseSection.getByRole('button').filter({ hasText: orderNumber }).first();
  if ((await candidate.count()) === 0) return;
  await candidate.click();
  await expect(page.getByRole('heading', { name: orderNumber, exact: true })).toBeVisible();

  await page
    .getByRole('combobox', { name: 'Destino Freight' })
    .selectOption('99100000-0000-4000-8000-000000000002');
  await page
    .getByRole('combobox', { name: 'Transportadora' })
    .selectOption('99100000-0000-4000-8000-000000000001');
  await page.getByRole('button', { name: 'Estimar flete' }).click();
  await expect(page.getByText(/Rango:|Histórico insuficiente/)).toBeVisible();
  await page.getByRole('button', { name: 'Liberar pedido' }).click();
  await expect(page.getByText('Pedido liberado a logística.')).toBeVisible();
}

async function openShipment(page: Page) {
  await page.getByLabel('Buscar despachos').fill(orderNumber);
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.getByRole('button').filter({ hasText: orderNumber }).first()).toBeVisible();
  await page.getByRole('button').filter({ hasText: orderNumber }).first().click();
}

async function operateShipment(page: Page) {
  await openShipment(page);

  const guide = page.getByLabel('Número de guía');
  if (await guide.isVisible().catch(() => false)) {
    await guide.fill('LOG-E2E-GUIDE-001');
    await page.getByRole('button', { name: 'Guardar guía' }).click();
    await expect(page.getByText('Guía registrada.')).toBeVisible();
  }

  const dispatch = page.getByRole('button', { name: 'Registrar salida' });
  if (await dispatch.isVisible().catch(() => false)) {
    await page.getByLabel('Costo real de salida, si ya se conoce').fill('22000');
    await dispatch.click();
    await expect(page.getByText('Despacho registrado.')).toBeVisible();
  }

  const deliver = page.getByRole('button', { name: 'Confirmar entrega' });
  if (await deliver.isVisible().catch(() => false)) {
    await page.getByLabel('Receptor').fill('Cliente QA');
    await page
      .getByLabel('Evidencia *')
      .first()
      .setInputFiles({
        name: 'delivery.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x01]),
      });
    await page.getByLabel('Observación').first().fill('Entrega nacional conforme.');
    await deliver.click();
    await expect(page.getByText('Entrega confirmada y enviada a cierre de Orders.')).toBeVisible();
  }

  await expect(
    page
      .locator('span')
      .filter({ hasText: /^DELIVERED$/ })
      .first(),
  ).toBeVisible();

  const satisfaction = page.getByRole('button', {
    name: 'Guardar satisfacción',
  });
  if (await satisfaction.isVisible().catch(() => false)) {
    await page.getByLabel('Comentario').fill('Entrega satisfactoria.');
    await satisfaction.click();
    await expect(page.getByText('Satisfacción registrada.')).toBeVisible();
  }

  await expect(page.getByRole('heading', { name: 'Trazabilidad' })).toBeVisible();
}

test('billing and logistics private routes redirect anonymous users', async ({ page }) => {
  await page.goto('/billing');
  await expect(page).toHaveURL(/\/login\/?$/);
  await page.goto('/logistics');
  await expect(page).toHaveURL(/\/login\/?$/);
});

test('logistics workspace is usable on Android without horizontal page overflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-android', 'Mobile smoke runs once.');

  await login(page, coordinatorEmail);
  await page.goto('/logistics');
  await expect(page.getByRole('heading', { level: 1, name: 'Logística y entrega' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await expect(page.getByRole('heading', { name: 'Por liberar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Despachos y entregas' })).toBeVisible();
});

test('invoice to national delivery lifecycle is traceable end to end', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Full logistics journey runs once.');

  await login(page, cajaEmail);
  await ensureInvoice(page, testInfo.retry);
  await logout(page);

  await login(page, coordinatorEmail);
  await advanceBillingIfPresent(page);
  await releaseShipmentIfPending(page);
  await operateShipment(page);
});

test('auditor can inspect logistics but cannot operate it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Authorization scenario runs once.');

  await login(page, auditorEmail);
  await page.goto('/logistics');
  await expect(page.getByRole('heading', { level: 1, name: 'Logística y entrega' })).toBeVisible();
  const release = page.getByRole('button', { name: 'Liberar pedido' });
  if (await release.count()) await expect(release).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Registrar salida' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Guardar satisfacción' })).toHaveCount(0);
});
