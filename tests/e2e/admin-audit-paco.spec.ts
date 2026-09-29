import { expect, test, type Page } from '@playwright/test';

const email = 'qa-superadmin@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for release E2E.');
  return value;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password());
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/);
}

test('Admin, Audit and PACO close the release-critical operator journey', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Release journey runs once.');

  await login(page);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Usuarios y perfiles' })).toBeVisible();
  await expect(page.getByText('QA Superadmin').first()).toBeVisible();

  await page.goto('/admin/roles');
  await expect(page.getByRole('heading', { name: 'Roles y permisos' })).toBeVisible();
  await expect(page.getByText('Superadministrador').first()).toBeVisible();

  await page.goto('/admin/security');
  await expect(page.getByRole('heading', { name: 'MFA y organización' })).toBeVisible();
  await expect(page.getByText('Nivel actual')).toBeVisible();

  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Auditoría del sistema' })).toBeVisible();
  await expect(page.getByText('RELEASE_E2E_READY')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Abrir PACO' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir PACO' }).click();
  await expect(page.getByLabel('PACO asistente operativo')).toBeVisible();

  await page.getByRole('button', { name: 'Resumen ahora' }).click();
  await expect(page.getByText(/Resumen:/).last()).toBeVisible();

  await page.getByRole('button', { name: 'Registrar actividad' }).click();
  await expect(page.getByLabel('Registro guiado de actividad')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actividad' })).toBeVisible();

  await page.getByRole('button', { name: 'Cancelar consulta' }).last().click();
  await expect(page.getByText('Consulta cancelada. Empecemos de nuevo.')).toBeVisible();
});
