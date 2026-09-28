import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

const sellerEmail = 'qa-seller@example.test';
const auditorEmail = 'qa-auditor@example.test';
const recoveryEmail = 'qa-recovery@example.test';
const mailpitUrl = 'http://127.0.0.1:54324';

interface MailpitSearchResponse {
  messages?: Array<{ ID: string }>;
}

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for authenticated tests.');
  return value;
}

async function login(page: Page, email: string, userPassword = password()) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(userPassword);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Control integral de pedidos' }),
  ).toBeVisible();
}

async function latestRecoveryLink(request: APIRequestContext, email: string) {
  const searchUrl = `${mailpitUrl}/api/v1/search?query=to:${encodeURIComponent(email)}&limit=1`;

  await expect
    .poll(async () => {
      const response = await request.get(searchUrl);
      if (!response.ok()) return null;
      const body = (await response.json()) as MailpitSearchResponse;
      return body.messages?.[0]?.ID ?? null;
    })
    .not.toBeNull();

  const search = await request.get(searchUrl);
  const body = (await search.json()) as MailpitSearchResponse;
  const messageId = body.messages?.[0]?.ID;
  if (!messageId) throw new Error('Recovery email was not captured by local Mailpit.');

  const htmlResponse = await request.get(`${mailpitUrl}/view/${messageId}.html`);
  const html = await htmlResponse.text();
  const match = html.match(/href=["']([^"']*\/auth\/v1\/verify[^"']*)["']/i);
  if (!match?.[1]) throw new Error('Recovery email did not contain the expected verification link.');

  return match[1].replaceAll('&amp;', '&');
}

test('anonymous users are redirected away from the private orders route', async ({ page }) => {
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ingresar al CRM' })).toBeVisible();
});

test('sales user restores session, creates, filters and opens an order', async ({
  page,
}, testInfo) => {
  await login(page, sellerEmail);

  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Control integral de pedidos' }),
  ).toBeVisible();

  const suffix = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toUpperCase();
  const orderNumber = `E2E-${suffix}-${testInfo.retry}-${Date.now()}`;

  await page.getByRole('button', { name: 'Crear pedido' }).click();
  await page.getByLabel('Número de pedido *').fill(orderNumber);
  await page.getByLabel('Cliente *').fill('Cliente Sintético E2E');
  await page.getByLabel('Ciudad *').fill('Cali');
  await page.getByLabel('Dirección de entrega *').fill('Calle QA 10 # 20-30');
  await page.getByLabel('Descripción *').fill('Cable sintético E2E');
  await page.getByLabel('Cantidad *').fill('2');
  await page.getByRole('button', { name: 'Crear pedido', exact: true }).last().click();

  await expect(page.getByText(orderNumber)).toBeVisible();

  await page.getByLabel('Buscar').fill(orderNumber);
  await page.getByRole('button', { name: 'Buscar' }).click();

  const row = page.getByRole('button', { name: new RegExp(orderNumber) });
  await expect(row).toBeVisible();
  await expect(page.getByText('Prioridad automática')).toBeVisible();
  await row.click();

  await expect(page.getByRole('heading', { level: 2, name: orderNumber })).toBeVisible();
  await expect(page.getByText('Cable sintético E2E')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('auditor can read orders but cannot create them', async ({ page }) => {
  await login(page, auditorEmail);
  await expect(page.getByRole('button', { name: 'Crear pedido' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Lista de pedidos' })).toBeVisible();
});

test('logout invalidates the local session and returns to login', async ({ page }) => {
  await login(page, sellerEmail);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ingresar al CRM' })).toBeVisible();

  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login\/?$/);
});

test('invalid recovery links are rejected without exposing internals', async ({ page }) => {
  await page.goto('/auth/update-password?code=invalid-recovery-code');
  await expect(page.getByRole('alert')).toContainText(/no es válido|expiró/i);
  await expect(page.getByText(/sql|jwt|token/i)).toHaveCount(0);
});

test('password recovery completes through local Supabase and Mailpit', async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Password recovery mutates a dedicated synthetic user once per CI run.',
  );

  await page.goto('/login');
  await page.getByLabel('Correo').fill(recoveryEmail);
  await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Si el correo está registrado, recibirás las instrucciones de recuperación.',
  );

  const verificationLink = await latestRecoveryLink(request, recoveryEmail);
  await page.goto(verificationLink);

  await expect(page).toHaveURL(/\/auth\/update-password\/?/);
  await expect(page.getByRole('heading', { name: 'Cambiar contraseña' })).toBeVisible();

  const newPassword = `${password()}-Recovered-2026!`;
  await page.getByLabel('Nueva contraseña').fill(newPassword);
  await page.getByLabel('Confirmar contraseña').fill(newPassword);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

  await expect(page).toHaveURL(/\/login\?passwordUpdated=1$/);
  await expect(page.getByRole('status')).toContainText('Tu contraseña fue actualizada');

  await page.getByLabel('Correo').fill(recoveryEmail);
  await page.getByLabel('Contraseña').fill(newPassword);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/);
});
