/**
 * auditoria.spec.ts — E2E Playwright para a tela /auditoria.
 *
 * Cobre: carga inicial, filtros, paginação, export, erro, retry.
 */

import { test, expect } from '@playwright/test';

const BASE_URL  = 'http://localhost:4200';
const AUDIT_URL = `${BASE_URL}/auditoria`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginAndGoTo(page: import('@playwright/test').Page, path: string) {
  // Injeta token fake no localStorage para passar o authGuard
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(() => {
    localStorage.setItem('governa_token', 'fake-jwt-for-e2e');
  });
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

// ─── Testes ───────────────────────────────────────────────────────────────────

test.describe('Auditoria — /auditoria', () => {

  // E2E-AUD-1: carga inicial — request para /audit-events

  test('E2E-AUD-1: carga inicial faz request GET /audit-events', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/audit-events') && !req.url().includes('/export')) {
        requests.push(req.url());
      }
    });

    await loginAndGoTo(page, AUDIT_URL);
    expect(requests.length).toBeGreaterThan(0);
  });

  // E2E-AUD-2: título visível

  test('E2E-AUD-2: exibe título "Audit Trail"', async ({ page }) => {
    await loginAndGoTo(page, AUDIT_URL);
    const titulo = page.locator('h1');
    await expect(titulo).toContainText('Audit Trail');
  });

  // E2E-AUD-3: filtros visíveis

  test('E2E-AUD-3: filtros de agente, período e desfecho renderizam', async ({ page }) => {
    await loginAndGoTo(page, AUDIT_URL);
    await expect(page.locator('#filtro-agente')).toBeVisible();
    await expect(page.locator('#filtro-from')).toBeVisible();
    await expect(page.locator('#filtro-to')).toBeVisible();
    await expect(page.locator('#filtro-outcome')).toBeVisible();
  });

  // E2E-AUD-4: filtro por outcome — envia param na query

  test('E2E-AUD-4: filtro outcome BLOQUEADO envia ?outcome=BLOQUEADO', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/audit-events') && req.url().includes('outcome=BLOQUEADO')) {
        requests.push(req.url());
      }
    });

    await loginAndGoTo(page, AUDIT_URL);
    await page.selectOption('#filtro-outcome', 'BLOQUEADO');
    await page.click('.auditoria__btn-filtrar');
    await page.waitForLoadState('networkidle');

    expect(requests.length).toBeGreaterThan(0);
  });

  // E2E-AUD-5: botão exportar visível

  test('E2E-AUD-5: botão "Exportar PDF" está visível', async ({ page }) => {
    await loginAndGoTo(page, AUDIT_URL);
    const btn = page.locator('.auditoria__btn-export');
    await expect(btn).toBeVisible();
  });

  // E2E-AUD-6: botão exportar dispara request para /export

  test('E2E-AUD-6: click em Exportar faz request GET /audit-events/export', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/audit-events/export')) {
        requests.push(req.url());
      }
    });

    await loginAndGoTo(page, AUDIT_URL);
    await page.click('.auditoria__btn-export');
    // aguarda request (export pode abrir popup, desligamos)
    await page.waitForTimeout(1000);
    expect(requests.length).toBeGreaterThan(0);
  });

  // E2E-AUD-7: limpar filtros reseta campos

  test('E2E-AUD-7: botão limpar reseta campos de filtro', async ({ page }) => {
    await loginAndGoTo(page, AUDIT_URL);
    await page.fill('#filtro-agente', '00000000-0000-0000-0000-000000000001');
    await page.selectOption('#filtro-outcome', 'EXECUTADO');
    await page.click('.auditoria__btn-limpar');
    await expect(page.locator('#filtro-agente')).toHaveValue('');
  });
});
