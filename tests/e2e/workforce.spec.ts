import { expect, test, type Page } from '@playwright/test';

const plannerEmail = 'qa-coordinator-a@example.test';
const androidPlannerEmail = 'qa-coordinator-b@example.test';
const iphonePlannerEmail = 'qa-coordinator-c@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for authenticated tests.');
  return value;
}

async function login(page: Page, email = plannerEmail) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password());
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/, { timeout: 15_000 });
}

async function openWorkforce(page: Page) {
  await page.goto('/workforce');
  await expect(page.getByRole('heading', { level: 1, name: 'Jornada y cronograma' })).toBeVisible();
}

test('anonymous users are redirected away from Workforce', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/workforce');
  await expect(page).toHaveURL(/\/login\/?$/);
});

test('planner completes the activity lifecycle with required photo evidence', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');

  await login(page);
  await openWorkforce(page);

  await expect(page.getByText('Tratamiento especial QA')).toBeVisible();

  await page.getByRole('button', { name: 'Registrar actividad' }).click();
  await page
    .getByRole('combobox', { name: 'Categoría', exact: true })
    .selectOption({ label: 'Despacho local' });
  await page
    .getByRole('combobox', { name: 'Subcategoría', exact: true })
    .selectOption({ label: 'Cargue y entrega' });
  await page
    .getByRole('combobox', { name: 'Actividad específica', exact: true })
    .selectOption({ label: 'Cargue' });
  await page.getByLabel('Inicio').fill('2026-09-29T07:30');
  await page.getByLabel('Fin').fill('2026-09-29T09:00');
  await page.getByRole('button', { name: 'Planificar actividad' }).click();

  await expect(page.getByRole('status')).toContainText('Actividad planificada correctamente.');

  const activity = page.getByRole('button', { name: /Cargue.*Planificada/ }).first();
  await expect(activity).toBeVisible();
  await activity.click();

  const dialog = page.getByRole('dialog', { name: 'Cargue' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Responsable').selectOption({ label: 'QA Coordinador B' });
  await dialog.getByRole('button', { name: 'Reasignar' }).click();
  await expect(dialog.locator('header p')).toContainText('QA Coordinador B');

  await dialog.getByRole('button', { name: 'Iniciar actividad' }).click();
  await expect(dialog.getByText(/En curso/)).toBeVisible();

  await dialog.getByLabel('Seleccionar archivo').setInputFiles({
    name: 'evidencia-workforce.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  });
  await expect(page.getByRole('status')).toContainText('Evidencia registrada.');

  await dialog.getByRole('button', { name: 'Finalizar' }).click();
  await expect(dialog.getByText(/Realizada/)).toBeVisible();

  await dialog.getByRole('button', { name: 'Cerrar detalle' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Semana' }).click();
  await expect(page.getByRole('columnheader', { name: 'Equipo' })).toBeVisible();

  await page.getByRole('button', { name: 'Mes' }).click();
  await expect(page.getByRole('region', { name: 'Planificación mensual' })).toBeVisible();
});

test('mobile Workforce uses timeline cards without page overflow', async ({ page }, testInfo) => {
  test.skip(!['mobile-iphone', 'mobile-android'].includes(testInfo.project.name));

  const email =
    testInfo.project.name === 'mobile-iphone' ? iphonePlannerEmail : androidPlannerEmail;
  await login(page, email);
  await openWorkforce(page);

  for (const label of ['07:30–09:00', '09:00–10:30', '10:30–12:00', '13:30–15:30', '15:30–17:30']) {
    await expect(page.getByRole('heading', { name: label }).first()).toBeVisible();
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole('button', { name: 'Semana' }).click();
  await expect(page.getByRole('region', { name: 'Cronograma semanal' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(await page.evaluate(() => window.scrollX)).toBe(0);

  await page.getByRole('button', { name: 'Mes' }).click();
  await expect(page.getByRole('region', { name: 'Planificación mensual' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Workforce has no page overflow at every required reference width', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');

  await login(page);

  for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await openWorkforce(page);

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `unexpected page overflow at ${width}px`,
    ).toBe(true);
  }
});
