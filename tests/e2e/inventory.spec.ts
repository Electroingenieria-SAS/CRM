import { expect, test, type Page } from '@playwright/test';

const auxEmail = 'qa-aux-logistica@example.test';
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

async function openCable(page: Page) {
  await page.goto('/inventory');
  await expect(page.getByRole('heading', { name: 'Inventario y trazabilidad' })).toBeVisible();
  await page.getByLabel('Buscar material').fill('INV-E2E-CABLE');
  await page.getByRole('button', { name: 'Buscar' }).click();
  const row = page.getByRole('row').filter({ hasText: 'INV-E2E-CABLE' });
  await row.getByRole('button', { name: 'Ver detalle' }).click();
  await expect(page.getByRole('heading', { name: /INV-E2E-CABLE/ })).toBeVisible();
}

test('inventory lifecycle is traceable from receipt to consumption', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Full inventory journey runs once.');

  await login(page, auxEmail);
  await openCable(page);

  const receiptForm = page.getByRole('heading', { name: 'Registrar entrada' }).locator('..');
  await receiptForm.getByLabel('Ubicación').selectOption('a1000000-0000-4000-8000-000000000001');
  await receiptForm.getByLabel('Cantidad (M)').fill('5');
  await receiptForm.getByLabel('Referencia de recepción').fill('E2E-RECEIPT');
  await receiptForm.getByRole('button', { name: 'Registrar entrada' }).click();
  await expect(page.getByRole('status')).toContainText('Entrada registrada');

  const reserveForm = page.getByRole('heading', { name: 'Reservar para pedido' }).locator('..');
  await reserveForm.getByLabel('Número de pedido').fill('INV-E2E-ORDER');
  await reserveForm.getByLabel('Cantidad (M)').fill('4');
  await reserveForm.getByRole('button', { name: 'Reservar' }).click();
  await expect(page.getByRole('status')).toContainText('Reserva confirmada');

  const reservationSection = page.getByRole('heading', { name: 'Reservas activas' }).locator('..');
  const reservation = reservationSection.getByRole('article').filter({ hasText: 'INV-E2E-ORDER' });
  await reservation.getByRole('button', { name: 'Pasar a picking' }).click();
  await expect(page.getByRole('status')).toContainText('Material comprometido');

  const pickedReservation = page
    .getByRole('heading', { name: 'Reservas activas' })
    .locator('..')
    .getByRole('article')
    .filter({ hasText: 'INV-E2E-ORDER' });
  await pickedReservation.getByLabel('Motivo / resultado').fill('Consumo E2E');
  await pickedReservation.getByRole('button', { name: 'Consumir' }).click();
  await expect(page.getByRole('status')).toContainText('Consumo registrado');

  await expect(page.getByText('RECEIPT').first()).toBeVisible();
  await expect(page.getByText('RESERVE').first()).toBeVisible();
  await expect(page.getByText('PICK').first()).toBeVisible();
  await expect(page.getByText('CONSUME').first()).toBeVisible();
  await expect(page.getByText(/Disponible 21 M/)).toBeVisible();
});

test('inventory responsive shell has no horizontal page overflow at required widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Viewport sweep runs once.');
  await login(page, auxEmail);
  await page.goto('/inventory');

  for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Inventario y trazabilidad' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, 'horizontal overflow at width ' + width).toBe(false);
  }
});

test('auditor can read inventory but cannot mutate it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Authorization scenario runs once.');
  await login(page, auditorEmail);
  await openCable(page);
  await expect(page.getByRole('button', { name: 'Registrar entrada' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reservar' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Aplicar ajuste' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar conteo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pasar a picking' })).toHaveCount(0);
});
