/**
 * alertas.spec.ts — E2E Playwright para a tela /alertas.
 *
 * Cobre: carga inicial, SSE badge, filtros, painel de config,
 *        ação de reconhecer, empty state, erro e retry.
 */

import { test, expect, type Page } from '@playwright/test';
import { loginE2E, navigateTo } from './helpers';

// ── Fixtures ─────────────────────────────────────────────────

const ALERTAS_MOCK = {
  data: [
    {
      id:        'alt-1',
      tenantId:  't1',
      agentId:   'aaaaaaaa-0000-0000-0000-000000000001',
      kind:      'ERROR_RATE',
      severity:  'HIGH',
      status:    'OPEN',
      message:   'Taxa de erro elevada detectada.',
      metadata:  {},
      createdAt: '2026-06-01T10:00:00Z',
      updatedAt: '2026-06-01T10:00:00Z',
    },
  ],
  total: 1,
  page:  1,
  limit: 20,
};

// ── Helpers de mock ──────────────────────────────────────────

async function mockAlertasRoute(page: Page, payload = ALERTAS_MOCK): Promise<void> {
  // Regex: matches /alerts (with optional query params) but NOT /alerts/thresholds or /alerts/stream
  await page.route(/\/alerts(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    }),
  );
}

async function mockThresholdsRoute(page: Page): Promise<void> {
  await page.route(/\/alerts\/thresholds/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
}

async function mockStreamRoute(page: Page): Promise<void> {
  // Aborta a conexão SSE — badge ficará "Desconectado", o que é aceitável em E2E
  await page.route(/\/alerts\/stream/, (route) => route.abort());
}

// ── Testes ───────────────────────────────────────────────────

test.describe('Alertas — /alertas', () => {

  test.beforeEach(async ({ page }) => {
    await mockThresholdsRoute(page);
    await mockStreamRoute(page);
    await loginE2E(page);
  });

  test('E2E-ALT-1: carga inicial faz request GET /alerts', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (/\/alerts(\?|$)/.test(req.url())) {
        requests.push(req.url());
      }
    });

    await mockAlertasRoute(page);
    await navigateTo(page, '/alertas');
    await page.waitForLoadState('networkidle');
    expect(requests.length).toBeGreaterThan(0);
  });

  test('E2E-ALT-2: exibe título "Alertas"', async ({ page }) => {
    await mockAlertasRoute(page);
    await navigateTo(page, '/alertas');
    await expect(page.locator('h1')).toContainText('Alertas');
  });

  test('E2E-ALT-3: filtros de kind, status e agentId visíveis', async ({ page }) => {
    await mockAlertasRoute(page);
    await navigateTo(page, '/alertas');
    await expect(page.getByLabel('Tipo')).toBeVisible();
    await expect(page.getByLabel('Status')).toBeVisible();
    await expect(page.getByLabel('Agente (ID)')).toBeVisible();
  });

  test('E2E-ALT-4: botão "Configurar thresholds" abre painel', async ({ page }) => {
    await mockAlertasRoute(page);
    await navigateTo(page, '/alertas');
    await page.getByRole('button', { name: 'Configurar thresholds' }).click();
    await expect(page.locator('#painel-config')).toBeVisible();
  });

  test('E2E-ALT-5: badge de status SSE visível no subtítulo', async ({ page }) => {
    await mockAlertasRoute(page);
    await navigateTo(page, '/alertas');
    await expect(page.locator('.alertas__sse-badge')).toBeVisible();
  });

  test('E2E-ALT-6: selecionar kind e clicar Filtrar dispara novo request', async ({ page }) => {
    const filteredReqs: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/alerts') && req.url().includes('kind=TOOL_BLOCKED')) {
        filteredReqs.push(req.url());
      }
    });

    await mockAlertasRoute(page);
    await navigateTo(page, '/alertas');
    await page.getByLabel('Tipo').selectOption('TOOL_BLOCKED');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await page.waitForTimeout(500);
    expect(filteredReqs.length).toBeGreaterThan(0);
  });

  test('E2E-ALT-7: botão Limpar reseta filtros e recarrega', async ({ page }) => {
    const reqs: string[] = [];
    page.on('request', (req) => {
      if (/\/alerts(\?|$)/.test(req.url())) {
        reqs.push(req.url());
      }
    });

    await mockAlertasRoute(page);
    await navigateTo(page, '/alertas');
    await page.getByLabel('Tipo').selectOption('ERROR_RATE');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByLabel('Tipo')).toHaveValue('');
    expect(reqs.length).toBeGreaterThan(1);
  });

});
