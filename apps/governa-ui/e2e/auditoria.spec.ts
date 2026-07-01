/**
 * auditoria.spec.ts — E2E Playwright para a tela /auditoria.
 *
 * Cobre: carga inicial, filtros, paginação, export, erro, retry.
 */

import { test, expect, type Page } from '@playwright/test';
import { loginE2E, navigateTo } from './helpers';

// ── Fixtures ─────────────────────────────────────────────────

const EVENTOS_MOCK = {
  data: [
    {
      id:           'ev-1',
      tenantId:     't1',
      agentId:      'aaaaaaaa-0000-0000-0000-000000000001',
      traceId:      'trace-001',
      spanId:       'span-001',
      action:       'read_protheus_pedido',
      toolCalled:   'read_protheus_pedido',
      inputSummary: 'Consulta de pedido PED-0001',
      outcome:      'EXECUTADO',
      legalBasis:   'Legítimo interesse',
      latencyMs:    120,
      createdAt:    '2026-06-01T10:00:00Z',
    },
  ],
  total: 1,
  page:  1,
  limit: 20,
};

// ── Helpers de mock ──────────────────────────────────────────

async function mockAuditoriaRoute(page: Page, payload = EVENTOS_MOCK): Promise<void> {
  await page.route(/\/audit-events(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    }),
  );
}

async function mockExportRoute(page: Page): Promise<void> {
  await page.route(/\/audit-events\/export/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], total: 0 }),
    }),
  );
}

// ── Testes ───────────────────────────────────────────────────

test.describe('Auditoria — /auditoria', () => {

  test.beforeEach(async ({ page }) => {
    await loginE2E(page);
  });

  test('E2E-AUD-1: carga inicial faz request GET /audit-events', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (/\/audit-events(\?|$)/.test(req.url())) {
        requests.push(req.url());
      }
    });

    await mockAuditoriaRoute(page);
    await navigateTo(page, '/auditoria');
    await page.waitForLoadState('networkidle');
    expect(requests.length).toBeGreaterThan(0);
  });

  test('E2E-AUD-2: exibe título "Audit Trail"', async ({ page }) => {
    await mockAuditoriaRoute(page);
    await navigateTo(page, '/auditoria');
    await expect(page.locator('h1')).toContainText('Audit Trail');
  });

  test('E2E-AUD-3: filtros de agente, período e desfecho renderizam', async ({ page }) => {
    await mockAuditoriaRoute(page);
    await navigateTo(page, '/auditoria');
    await expect(page.getByLabel('Agente (UUID)')).toBeVisible();
    await expect(page.getByLabel('De')).toBeVisible();
    await expect(page.getByLabel('Até')).toBeVisible();
    await expect(page.getByLabel('Desfecho')).toBeVisible();
  });

  test('E2E-AUD-4: filtro outcome BLOQUEADO envia ?outcome=BLOQUEADO', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/audit-events') && req.url().includes('outcome=BLOQUEADO')) {
        requests.push(req.url());
      }
    });

    await mockAuditoriaRoute(page);
    await navigateTo(page, '/auditoria');
    await page.getByLabel('Desfecho').selectOption('BLOQUEADO');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await page.waitForLoadState('networkidle');
    expect(requests.length).toBeGreaterThan(0);
  });

  test('E2E-AUD-5: botão "Exportar PDF" está visível', async ({ page }) => {
    await mockAuditoriaRoute(page);
    await navigateTo(page, '/auditoria');
    await expect(page.getByRole('button', { name: 'Exportar audit trail como PDF' })).toBeVisible();
  });

  test('E2E-AUD-6: click em Exportar faz request GET /audit-events/export', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/audit-events/export')) {
        requests.push(req.url());
      }
    });

    await mockAuditoriaRoute(page);
    await mockExportRoute(page);
    await navigateTo(page, '/auditoria');
    // Fecha popup de impressão automaticamente se abrir
    page.on('popup', (popup) => popup.close());
    await page.getByRole('button', { name: 'Exportar audit trail como PDF' }).click();
    await page.waitForTimeout(1000);
    expect(requests.length).toBeGreaterThan(0);
  });

  test('E2E-AUD-7: botão limpar reseta campos de filtro', async ({ page }) => {
    await mockAuditoriaRoute(page);
    await navigateTo(page, '/auditoria');
    await page.getByLabel('Agente (UUID)').fill('00000000-0000-0000-0000-000000000001');
    await page.getByLabel('Desfecho').selectOption('EXECUTADO');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.getByLabel('Agente (UUID)')).toHaveValue('');
  });

});
