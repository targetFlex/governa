// ============================================================
// politicas.spec.ts — Playwright E2E  (7 cenários)
//
// Rota: /politicas/:id
// API mocked via page.route() — sem dependência de backend real
// ============================================================

import { test, expect } from '@playwright/test';
import { loginE2E, navigateTo } from './helpers';

const POLICY_ID  = 'policy-test-1';
const POLICY_URL = `/politicas/${POLICY_ID}`;
const API_URL    = `**/policies/${POLICY_ID}`;

const POLICY_STUB = {
  id:             POLICY_ID,
  tenantId:       'tenant-a',
  name:           'Atendimento Consultivo',
  autonomyLevel:  'CONSULTIVO',
  allowedActions: ['read_protheus_pedido', 'read_protheus_cliente'],
  approvers:      [],
  version:        '1.0.0',
};

test.beforeEach(async ({ page }) => {
  await loginE2E(page);
});

test('exibe cabeçalho e versão atual da política', async ({ page }) => {
  await page.route(API_URL, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: POLICY_STUB } });
    } else {
      route.continue();
    }
  });
  await navigateTo(page, POLICY_URL);
  await expect(page.getByRole('heading', { name: /Configurar Política/ })).toBeVisible();
  await expect(page.getByText('1.0.0')).toBeVisible();
});

test('renderiza 3 cards de nível; CONSULTIVO selecionado por padrão', async ({ page }) => {
  await page.route(API_URL, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: POLICY_STUB } });
    } else {
      route.continue();
    }
  });
  await navigateTo(page, POLICY_URL);
  const cards = page.locator('[role="radio"]');
  await expect(cards).toHaveCount(3);
  await expect(page.locator('[role="radio"][aria-checked="true"]'))
    .toContainText('Somente Consulta');
});

test('selecionar ASSISTIDO exibe seção de aprovadores e limites', async ({ page }) => {
  await page.route(API_URL, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: POLICY_STUB } });
    } else {
      route.continue();
    }
  });
  await navigateTo(page, POLICY_URL);
  await page.locator('[role="radio"]').filter({ hasText: 'Com Aprovação' }).click();

  await expect(page.getByLabel(/Valor máximo/)).toBeVisible();
  await expect(page.getByLabel(/Janela de ação/)).toBeVisible();
  await expect(page.getByText('+ Adicionar aprovador')).toBeVisible();
});

test('selecionar AUTONOMO exibe limites mas não aprovadores', async ({ page }) => {
  await page.route(API_URL, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: POLICY_STUB } });
    } else {
      route.continue();
    }
  });
  await navigateTo(page, POLICY_URL);
  await page.locator('[role="radio"]').filter({ hasText: 'Ação Direta' }).click();

  await expect(page.getByLabel(/Valor máximo/)).toBeVisible();
  await expect(page.getByText('+ Adicionar aprovador')).not.toBeVisible();
});

test('salvar política chama PATCH e exibe banner de sucesso', async ({ page }) => {
  const updatedPolicy = { ...POLICY_STUB, name: 'Novo Nome', version: '1.1.0' };

  await page.route(API_URL, (route) => {
    if (route.request().method() === 'PATCH') {
      route.fulfill({ json: { data: updatedPolicy } });
    } else {
      route.fulfill({ json: { data: POLICY_STUB } });
    }
  });

  await navigateTo(page, POLICY_URL);
  await page.getByLabel('Nome da política').clear();
  await page.getByLabel('Nome da política').fill('Novo Nome');
  await page.getByRole('button', { name: /Salvar política/ }).click();

  await expect(page.getByRole('status')).toContainText('atualizada com sucesso');
  await expect(page.getByText('1.1.0').first()).toBeVisible();
});

test('exibe banner de erro com retry quando GET retorna 503', async ({ page }) => {
  await page.route(API_URL, (route) => {
    route.fulfill({ status: 503, json: {} });
  });

  await navigateTo(page, POLICY_URL);
  await expect(page.locator('.pf__error')).toBeVisible();
  await expect(page.getByRole('button', { name: /Tentar novamente/ })).toBeVisible();
});

test('retry após erro dispara novo GET e carrega a política', async ({ page }) => {
  let callCount = 0;
  await page.route(API_URL, (route) => {
    callCount++;
    if (callCount === 1) {
      route.fulfill({ status: 503, json: {} });
    } else {
      route.fulfill({ json: { data: POLICY_STUB } });
    }
  });

  await navigateTo(page, POLICY_URL);
  await page.getByRole('button', { name: /Tentar novamente/ }).click();
  await expect(page.getByRole('heading', { name: /Configurar Política/ })).toBeVisible();
  await expect(page.getByLabel('Nome da política')).toHaveValue('Atendimento Consultivo');
});
