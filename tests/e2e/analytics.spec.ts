import { expect, test, type Page } from '@playwright/test';

const superAdminEmail = 'qa-superadmin@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for Analytics tests.');
  return value;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(superAdminEmail);
  await page.getByLabel('Contraseña').fill(password());
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/);
}

async function setRange(page: Page) {
  await page.getByLabel('Desde').fill('2026-09-29');
  await page.getByLabel('Hasta').fill('2026-09-29');
}

function metricValue(page: Page, label: string) {
  return page.locator('article').filter({ hasText: label }).locator('strong');
}

function vsmStage(page: Page, label: string) {
  const region = page.getByRole('region', { name: 'Espera por etapa' });
  return region.getByRole('article').filter({ hasText: label });
}

test('dashboard, filters, VSM and report explorer use synthetic analytics data', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Full analytics journey runs once.');

  await login(page);
  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Qué está pasando ahora' })).toBeVisible();
  await setRange(page);
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByText('AN-E2E-BLOCKED')).toBeVisible();

  await page.getByRole('combobox', { name: 'Etapa' }).selectOption('ALISTAMIENTO');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByText('AN-E2E-BLOCKED')).toBeVisible();

  await page.getByRole('link', { name: 'VSM' }).click();
  await expect(page.getByRole('heading', { name: 'Tiempos y cuellos de botella' })).toBeVisible();
  await setRange(page);
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(vsmStage(page, 'Alistamiento')).toBeVisible();

  await page.getByLabel('Pedido o clave histórica').fill('aa100000-0000-4000-8000-000000000001');
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.getByText('AN-E2E-FAST')).toBeVisible();
  await expect(page.getByText('Lead time laboral')).toBeVisible();

  await page.getByRole('link', { name: 'Reportes' }).click();
  await expect(page.getByRole('heading', { name: 'Reportes reutilizables' })).toBeVisible();
  await page.getByLabel('Reporte').selectOption('stage_times');
  await setRange(page);
  await page.getByLabel('Buscar').fill('AN-E2E');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByText('AN-E2E-FAST')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar página CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('stage_times-2026-09-29-2026-09-29.csv');
});

test('analytics dashboard has no page overflow at required reference widths', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Viewport sweep runs once.');
  await login(page);

  for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: width <= 430 ? 760 : 900 });
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: 'Qué está pasando ahora' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, 'horizontal overflow at ' + width + 'px').toBe(false);
  }
});

test('historical CSV preview, partial apply and checksum replay are idempotent', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Import mutation runs once.');
  await login(page);
  await page.goto('/analytics/imports');
  await expect(page.getByRole('heading', { name: 'Importación segura y trazable' })).toBeVisible();

  const csv = [
    'externalKey,externalOrderKey,orderNumber,clientName,sellerReference,routeCode,stepCode,taskCreatedAt,startedAt,completedAt,waitingSeconds,processingSeconds,blockedSeconds,transitSeconds',
    'E2E-HIST-ROW-1,E2E-HIST-1,HIST-E2E-001,Cliente Histórico,V-1,LOCAL_DISPATCH,ALISTAMIENTO,2026-09-28T12:00:00Z,2026-09-28T13:00:00Z,2026-09-28T14:00:00Z,3600,3600,0,0',
    'E2E-HIST-ROW-2,E2E-HIST-2,HIST-E2E-002,Cliente Inválido,V-2,LOCAL_DISPATCH,ETAPA_INEXISTENTE,2026-09-28T12:00:00Z,2026-09-28T13:00:00Z,2026-09-28T14:00:00Z,3600,3600,0,0',
  ].join('\n');

  await page.getByLabel('Archivo CSV').setInputFiles({
    name: 'analytics-e2e.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Validar y previsualizar' }).click();

  await expect(metricValue(page, 'Válidas')).toHaveText('1');
  await expect(metricValue(page, 'Rechazadas')).toHaveText('1');
  await expect(page.getByText(/Etapa no reconocida/)).toBeVisible();

  await page.getByRole('button', { name: 'Aplicar filas válidas' }).click();
  await expect(page.getByRole('status')).toContainText('1 aplicadas, 1 rechazadas');

  await page.getByRole('button', { name: 'Validar y previsualizar' }).click();
  await expect(metricValue(page, 'Idempotente')).toHaveText('Sí');
});

test('analytics routes provide cross-browser semantic smoke', async ({ page }) => {
  await login(page);
  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Qué está pasando ahora' })).toBeVisible();
  await page.goto('/analytics/vsm');
  await expect(page.getByRole('heading', { name: 'Tiempos y cuellos de botella' })).toBeVisible();
  await page.goto('/analytics/reports');
  await expect(page.getByRole('heading', { name: 'Reportes reutilizables' })).toBeVisible();
});
