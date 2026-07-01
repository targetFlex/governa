// ============================================================
// e2e/agentes.spec.ts
//
// Playwright E2E — inventário de agentes (/agentes)
//
// Cenários:
//   1. Página carrega e seção de inventário é visível
//   2. API GET /agents retorna dados → cards visíveis
//   3. Filtro por status (chip ACTIVE) reduz a lista
//   4. Agente DEPRECATED não exibe botões de ação
//   5. Ação Pausar faz POST /agents/:id/pause → badge muda
//   6. Ação Ativar faz POST /agents/:id/activate → badge muda
//   7. Estado de erro exibe banner com retry
//
// Pré-requisitos:
//   - governa-ui rodando em UI_URL (default: http://localhost:4200)
//   - governa-core rodando com rotas GET|POST /agents
//   - Usuário autenticado (auth interceptada via page.route se necessário)
// ============================================================
import { test, expect, type Page } from '@playwright/test';
import { loginE2E, navigateTo } from './helpers';

// ── Fixtures ─────────────────────────────────────────────────

const agentesMock = {
  data: [
    {
      id:           'ag-1',
      tenantId:     'tenant-tf',
      name:         'Agente de Atendimento',
      description:  'Responde consultas via Protheus',
      ownerId:      'user-1',
      policyId:     'policy-1',
      status:       'ACTIVE',
      modelId:      'claude-sonnet-4',
      tools:        ['read_protheus_pedido'],
      createdAt:    '2026-05-01T10:00:00Z',
      updatedAt:    '2026-06-01T08:00:00Z',
      lastActiveAt: '2026-06-13T14:30:00Z',
    },
    {
      id:           'ag-2',
      tenantId:     'tenant-tf',
      name:         'Agente Financeiro',
      description:  'Consulta limites de crédito',
      ownerId:      'user-1',
      policyId:     'policy-2',
      status:       'PAUSED',
      modelId:      'claude-haiku-4',
      tools:        ['read_protheus_cliente'],
      createdAt:    '2026-05-10T10:00:00Z',
      updatedAt:    '2026-06-05T08:00:00Z',
      lastActiveAt: '2026-06-10T09:00:00Z',
    },
    {
      id:           'ag-3',
      tenantId:     'tenant-tf',
      name:         'Agente Legado v1',
      description:  'Versão descontinuada',
      ownerId:      'user-1',
      policyId:     null,
      status:       'DEPRECATED',
      modelId:      'gpt-3.5-turbo',
      tools:        [],
      createdAt:    '2025-01-01T10:00:00Z',
      updatedAt:    '2025-12-31T08:00:00Z',
      lastActiveAt: null,
    },
  ],
  total: 3,
};

// ── Helpers ──────────────────────────────────────────────────

async function mockAgentesAPI(page: Page, payload = agentesMock): Promise<void> {
  await page.route('**/agents', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
    } else {
      route.continue();
    }
  });
}

async function mockAgentesAPIError(page: Page): Promise<void> {
  await page.route('**/agents', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Serviço temporariamente indisponível.' }),
    }),
  );
}

async function mockPauseAPI(page: Page, id: string): Promise<void> {
  await page.route(`**/agents/${id}/pause`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { ...agentesMock.data[0], id, status: 'PAUSED' },
      }),
    }),
  );
}

async function mockActivateAPI(page: Page, id: string): Promise<void> {
  await page.route(`**/agents/${id}/activate`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { ...agentesMock.data[1], id, status: 'ACTIVE' },
      }),
    }),
  );
}

// ── Testes ────────────────────────────────────────────────────

test.describe('GET /agents — inventário de agentes', () => {

  test.beforeEach(async ({ page }) => {
    await loginE2E(page);
  });

  test('Given rota /agentes, When carregada, Then seção de inventário é visível', async ({ page }) => {
    await mockAgentesAPI(page);
    await navigateTo(page, '/agentes');
    await expect(page.getByRole('region', { name: 'Inventário de agentes' })).toBeVisible();
  });

  test('Given API com 3 agentes, When página carrega, Then exibe 3 cards', async ({ page }) => {
    await mockAgentesAPI(page);
    await navigateTo(page, '/agentes');
    await expect(page.locator('app-agente-card')).toHaveCount(3);
  });

  test('Given API com 3 agentes, When chip ACTIVE clicado, Then exibe apenas 1 card', async ({ page }) => {
    await mockAgentesAPI(page);
    await navigateTo(page, '/agentes');

    // Aguarda os chips aparecerem
    await page.getByRole('button', { name: /Ativos/i }).click();

    // Then: apenas 1 agente ACTIVE
    await expect(page.locator('app-agente-card')).toHaveCount(1);
  });

  test('Given agente DEPRECATED, When exibido, Then não renderiza botões de ação', async ({ page }) => {
    await mockAgentesAPI(page);
    await navigateTo(page, '/agentes');

    // Localiza o card do agente depreciado pelo nome
    const cardDeprecado = page.locator('app-agente-card', {
      has: page.getByText('Agente Legado v1'),
    });
    await expect(cardDeprecado.locator('button')).toHaveCount(0);
  });

  test('Given agente ACTIVE, When Pausar clicado, Then badge muda para "Pausado"', async ({ page }) => {
    await mockAgentesAPI(page);
    await mockPauseAPI(page, 'ag-1');
    await navigateTo(page, '/agentes');

    // Encontra o card do agente ativo e clica em Pausar
    const cardAtivo = page.locator('app-agente-card', {
      has: page.getByText('Agente de Atendimento'),
    });
    await cardAtivo.getByRole('button', { name: /pausar/i }).click();

    // Aguarda o badge atualizar
    await expect(cardAtivo.getByRole('status')).toHaveText('Pausado');
  });

  test('Given agente PAUSED com política, When Ativar clicado, Then badge muda para "Ativo"', async ({ page }) => {
    await mockAgentesAPI(page);
    await mockActivateAPI(page, 'ag-2');
    await navigateTo(page, '/agentes');

    const cardPausado = page.locator('app-agente-card', {
      has: page.getByText('Agente Financeiro'),
    });
    await cardPausado.getByRole('button', { name: /ativar/i }).click();

    await expect(cardPausado.getByRole('status')).toHaveText('Ativo');
  });

  test('Given lista vazia, When página carrega, Then exibe mensagem de empty state', async ({ page }) => {
    await mockAgentesAPI(page, { data: [], total: 0 });
    await navigateTo(page, '/agentes');
    await expect(page.getByText('Nenhum agente encontrado.')).toBeVisible();
    await expect(page.locator('app-agente-card')).toHaveCount(0);
  });

  test('Given API com erro 503, When página carrega, Then exibe banner de erro com retry', async ({ page }) => {
    await mockAgentesAPIError(page);
    await navigateTo(page, '/agentes');
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  });

});
