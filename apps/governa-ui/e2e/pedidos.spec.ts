// ============================================================
// e2e/pedidos.spec.ts
//
// Playwright E2E — listagem de pedidos (GET /pedidos)
//
// Cenários:
//   1. Página carrega e exibe título acessível
//   2. API GET /pedidos retorna dados → cards visíveis
//   3. Estado vazio exibe mensagem adequada
//   4. Pedido cancelado exibe badge correto
//   5. Pedido com dataEntregaPrevista exibe a data
//   6. Estado de erro exibe banner e botão de retry
//
// Pré-requisitos:
//   - governa-ui rodando em UI_URL (default: http://localhost:4200)
//   - governa-gateway rodando com rota GET /pedidos
// ============================================================
import { test, expect, type Page } from '@playwright/test';
import { loginE2E, navigateTo } from './helpers';

// ── Helpers de mock ──────────────────────────────────────────
async function mockPedidosAPI(page: Page, payload: object): Promise<void> {
  // Usa regex para capturar /pedidos com quaisquer query params
  await page.route(/\/pedidos(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    }),
  );
}

async function mockPedidosAPIError(page: Page): Promise<void> {
  await page.route(/\/pedidos(\?|$)/, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Serviço indisponível.' }),
    }),
  );
}

const pedidosMock = {
  data: [
    {
      id: 'p1',
      numero: 'PED-0001',
      clienteId: 'c1',
      clienteNome: 'Acme Tecnologia Ltda',
      status: 'ABERTO',
      valor: 15750.50,
      moeda: 'BRL',
      dataEmissao: '2026-01-15T00:00:00Z',
      dataEntregaPrevista: '2026-02-01T00:00:00Z',
      itens: [
        { codigo: 'PROD01', descricao: 'Licença', quantidade: 1, valorUnitario: 15750.50, valorTotal: 15750.50 },
      ],
    },
    {
      id: 'p2',
      numero: 'PED-0002',
      clienteId: 'c2',
      clienteNome: 'Beta Sistemas ME',
      status: 'CANCELADO',
      valor: 8200,
      moeda: 'BRL',
      dataEmissao: '2026-01-20T00:00:00Z',
      dataEntregaPrevista: null,
      itens: [],
    },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
};

// ── Testes ────────────────────────────────────────────────────

test.describe('GET /pedidos — listagem', () => {

  test.beforeEach(async ({ page }) => {
    await loginE2E(page);
  });

  test('Given a rota /pedidos, When carregada, Then seção de pedidos é visível', async ({ page }) => {
    await mockPedidosAPI(page, pedidosMock);
    await navigateTo(page, '/pedidos');
    await expect(page.getByRole('region', { name: 'Lista de pedidos' })).toBeVisible();
  });

  test('Given API com 2 pedidos, When página carrega, Then exibe 2 cards', async ({ page }) => {
    await mockPedidosAPI(page, pedidosMock);
    await navigateTo(page, '/pedidos');
    const cards = page.locator('app-pedido-card');
    await expect(cards).toHaveCount(2);
  });

  test('Given API com 2 pedidos, When página carrega, Then número do primeiro pedido aparece', async ({ page }) => {
    await mockPedidosAPI(page, pedidosMock);
    await navigateTo(page, '/pedidos');
    await expect(page.getByText('PED-0001')).toBeVisible();
  });

  test('Given API com 2 pedidos, When página carrega, Then nome do cliente aparece', async ({ page }) => {
    await mockPedidosAPI(page, pedidosMock);
    await navigateTo(page, '/pedidos');
    await expect(page.getByText('Acme Tecnologia Ltda')).toBeVisible();
  });

  test('Given pedido CANCELADO, When exibido, Then badge "Cancelado" é visível', async ({ page }) => {
    await mockPedidosAPI(page, pedidosMock);
    await navigateTo(page, '/pedidos');
    await expect(page.getByText('Cancelado')).toBeVisible();
  });

  test('Given pedido com dataEntregaPrevista, When exibido, Then linha de entrega é visível', async ({ page }) => {
    await mockPedidosAPI(page, pedidosMock);
    await navigateTo(page, '/pedidos');
    await expect(page.getByText('Entrega prevista')).toBeVisible();
  });

  test('Given API com lista vazia, When página carrega, Then exibe mensagem de lista vazia', async ({ page }) => {
    await mockPedidosAPI(page, { data: [], total: 0, page: 1, pageSize: 20 });
    await navigateTo(page, '/pedidos');
    await expect(page.locator('app-pedido-card')).toHaveCount(0);
    const emptyMsg = page.getByText(/nenhum pedido|sem pedidos|lista vazia/i);
    await expect(emptyMsg).toBeVisible();
  });

  test('Given API com erro 503, When página carrega, Then exibe banner de erro com retry', async ({ page }) => {
    await mockPedidosAPIError(page);
    await navigateTo(page, '/pedidos');
    const errorBanner = page.locator('[role="alert"]');
    await expect(errorBanner).toBeVisible();
    const retryBtn = page.getByRole('button', { name: 'Tentar novamente' });
    await expect(retryBtn).toBeVisible();
  });

});
