import { expect, test, type Page } from '@playwright/test';

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

async function selectContaining(page: Page, label: string, text: RegExp) {
  const select = page.getByLabel(label, { exact: true });
  const option = select.locator('option').filter({ hasText: text }).first();
  const value = await option.getAttribute('value');
  if (!value) throw new Error(`No option matching ${text.source} for ${label}`);
  await select.selectOption(value);
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

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await expect(page.getByRole('heading', { name: 'Por liberar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Despachos y entregas' })).toBeVisible();
});

test('invoice to national delivery lifecycle is traceable end to end', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Full logistics journey runs once.');

  await login(page, cajaEmail);
  await page.goto('/billing');
  await page.getByLabel('Buscar pedido o cliente').fill('LOG-E2E-BILLING');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('button').filter({ hasText: 'LOG-E2E-BILLING' }).click();

  const invoiceNumber = `LOG-E2E-FAC-${testInfo.retry}`;
  await page.getByLabel('Número de factura').fill(invoiceNumber);
  await page.getByLabel('Valor registrado').fill('250000');
  await page.getByRole('button', { name: 'Registrar factura' }).click();
  await expect(page.getByText('Factura registrada correctamente.')).toBeVisible();
  await logout(page);

  await login(page, coordinatorEmail);
  await page.goto('/billing');
  await page.getByLabel('Buscar pedido o cliente').fill('LOG-E2E-BILLING');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('button').filter({ hasText: 'LOG-E2E-BILLING' }).click();
  await expect(page.getByText('Facturación lista')).toBeVisible();
  await page.getByRole('button', { name: 'Liberar hacia logística' }).click();
  await expect(page.getByText('Pedido liberado hacia logística.')).toBeVisible();

  await page.goto('/logistics');
  await page.getByLabel('Buscar candidatos').fill('LOG-E2E-BILLING');
  await page.getByRole('button', { name: 'Buscar' }).first().click();
  await page.getByRole('button').filter({ hasText: 'LOG-E2E-BILLING' }).click();

  await selectContaining(page, 'Destino Freight', /Armenia/i);
  await selectContaining(page, 'Transportadora', /Colvanes/i);
  await page.getByRole('button', { name: 'Estimar flete' }).click();
  await expect(page.getByText(/Rango:|Histórico insuficiente/)).toBeVisible();
  await page.getByRole('button', { name: 'Liberar pedido' }).click();
  await expect(page.getByText('Pedido liberado a logística.')).toBeVisible();

  await page.getByLabel('Buscar despachos').fill('LOG-E2E-BILLING');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await page.getByRole('button').filter({ hasText: 'LOG-E2E-BILLING' }).click();

  await page.getByLabel('Número de guía').fill('LOG-E2E-GUIDE-001');
  await page.getByRole('button', { name: 'Guardar guía' }).click();
  await expect(page.getByText('Guía registrada.')).toBeVisible();

  await page.getByLabel('Costo real de salida, si ya se conoce').fill('22000');
  await page.getByRole('button', { name: 'Registrar salida' }).click();
  await expect(page.getByText('Despacho registrado.')).toBeVisible();

  await page.getByLabel('Receptor').fill('Cliente QA');
  await page.getByLabel('Evidencia *').first().setInputFiles({
    name: 'delivery.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x01]),
  });
  await page.getByLabel('Observación').first().fill('Entrega nacional conforme.');
  await page.getByRole('button', { name: 'Confirmar entrega' }).click();
  await expect(page.getByText('Entrega confirmada y enviada a cierre de Orders.')).toBeVisible();

  await expect(page.getByText('DELIVERED').first()).toBeVisible();
  await page.getByLabel('Comentario').fill('Entrega satisfactoria.');
  await page.getByRole('button', { name: 'Guardar satisfacción' }).click();
  await expect(page.getByText('Satisfacción registrada.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trazabilidad' })).toBeVisible();
  await expect(page.getByText('DELIVERED').first()).toBeVisible();
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
