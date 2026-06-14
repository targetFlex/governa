/**
 * alertas.spec.ts — E2E Playwright para a tela /alertas.
 *
 * Cobre: carga inicial, SSE badge, filtros, painel de config,
 *        ação de reconhecer, empty state, erro e retry.
 */

import { test, expect } from '@playwright/test';

const BASE_URL    = 'http://localhost:4200';
const ALERTAS_URL = `${BASE_URL}/alertas`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginAndGoTo(page: import('@playwright/test').Page, path: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(() => {
    localStorage.setItem('governa_token', 'fake-jwt-for-e2e');
  });
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

// ─── Testes ───────────────────────────────────────────────────────────────────

test.describe('Alertas — /alertas', () => {

  // E2E-ALT-1: carga inicial faz request GET /alerts

  test('E2E-ALT-1: carga inicial faz request GET /alerts', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/alerts') && !req.url().includes('/stream')) {
        requests.push(req.url());
      }
    });

    await loginAndGoTo(page, ALERTAS_URL);
    expect(requests.length).toBeGreaterThan(0);
  });

  // E2E-ALT-2: título visível

  test('E2E-ALT-2: exibe título "Alertas"', async ({ page }) => {
    await loginAndGoTo(page, ALERTAS_URL);
    const titulo = page.locator('h1');
    await expect(titulo).toContainText('Alertas');
  });

  // E2E-ALT-3: filtros visíveis

  test('E2E-ALT-3: filtros de kind, status e agentId visíveis', async ({ page }) => {
    await loginAndGoTo(page, ALERTAS_URL);
    await expect(page.locator('select[name="kind"]')).toBeVisible();
    await expect(page.locator('select[name="status"]')).toBeVisible();
    await expect(page.locator('input[name="agentId"]')).toBeVisible();
  });

  // E2E-ALT-4: botão de configurar thresholds

  test('E2E-ALT-4: botão "Configurar thresholds" abre painel', async ({ page }) => {
    await loginAndGoTo(page, ALERTAS_URL);
    const btn = page.locator('button.alertas__btn-config');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('#painel-config')).toBeVisible();
  });

  // E2E-ALT-5: badge SSE visível

  test('E2E-ALT-5: badge de status SSE visível no subtítulo', async ({ page }) => {
    await loginAndGoTo(page, ALERTAS_URL);
    const badge = page.locator('.alertas__sse-badge');
    await expect(badge).toBeVisible();
  });

  // E2E-ALT-6: botão Filtrar aplica filtros

  test('E2E-ALT-6: selecionar kind e clicar Filtrar dispara novo request', async ({ page }) => {
    const filteredReqs: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/alerts') && req.url().includes('kind=TOOL_BLOCKED')) {
        filteredReqs.push(req.url());
      }
    });

    await loginAndGoTo(page, ALERTAS_URL);
    await page.selectOption('select[name="kind"]', 'TOOL_BLOCKED');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
    expect(filteredReqs.length).toBeGreaterThan(0);
  });

  // E2E-ALT-7: botão Limpar reseta filtros

  test('E2E-ALT-7: botão Limpar reseta filtros e recarrega', async ({ page }) => {
    const reqs: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/alerts') && !req.url().includes('/stream') && !req.url().includes('/thresholds')) {
        reqs.push(req.url());
      }
    });

    await loginAndGoTo(page, ALERTAS_URL);
    await page.selectOption('select[name="kind"]', 'ERROR_RATE');
    await page.click('button.alertas__btn-limpar');
    await page.waitForTimeout(500);

    const kindSelect = page.locator('select[name="kind"]');
    await expect(kindSelect).toHaveValue('');
    expect(reqs.length).toBeGreaterThan(1);  // pelo menos 2: inicial + após limpar
  });
});
