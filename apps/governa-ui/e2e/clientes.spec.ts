// ============================================================
// e2e/clientes.spec.ts
//
// Playwright E2E — listagem de clientes (GET /clientes)
//
// Cenários:
//   1. Página carrega e exibe título acessível
//   2. API GET /clientes retorna dados → cards visíveis
//   3. Estado vazio exibe mensagem adequada
//   4. Filtro reduz a lista
//
// Pré-requisitos:
//   - governa-ui rodando em UI_URL (default: http://localhost:4200)
//   - governa-gateway rodando com rota GET /clientes
// ============================================================
import { test, expect, type Page } from '@playwright/test';

// ── Helper: intercepta e injeta resposta mockada ──────────────
async function mockClientesAPI(page: Page, payload: object): Promise<void> {
  await page.route('**/clientes**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    }),
  );
}

const clientesMock = {
  data: [
    {
      id: 'c1',
      codigo: 'CLI001',
      nome: 'Empresa Exemplo LTDA',
      tipoPessoa: 'PJ',
      documento: '12.345.678/0001-90',
      email: 'contato@empresa.com',
      telefone: '(11) 99999-9999',
      ativo: true,
      limiteCredito: 50000,
      saldoDevedor: 12500,
      moeda: 'BRL',
      criadoEm: '2024-01-01T00:00:00Z',
      atualizadoEm: '2024-01-15T00:00:00Z',
    },
    {
      id: 'c2',
      codigo: 'CLI002',
      nome: 'Maria Oliveira',
      tipoPessoa: 'PF',
      documento: '123.456.789-00',
      email: 'maria@pessoal.com',
      telefone: null,
      ativo: false,
      limiteCredito: 10000,
      saldoDevedor: 0,
      moeda: 'BRL',
      criadoEm: '2024-02-01T00:00:00Z',
      atualizadoEm: '2024-02-10T00:00:00Z',
    },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
};

// ── Testes ────────────────────────────────────────────────────
test.describe('GET /clientes — listagem', () => {

  test('Given a rota /clientes, When carregada, Then título principal é visível', async ({ page }) => {
    await mockClientesAPI(page, clientesMock);
    await page.goto('/clientes');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('Given API com 2 clientes, When página carrega, Then exibe 2 cards', async ({ page }) => {
    await mockClientesAPI(page, clientesMock);
    await page.goto('/clientes');
    const cards = page.locator('app-cliente-card');
    await expect(cards).toHaveCount(2);
  });

  test('Given API com 2 clientes, When página carrega, Then nome do primeiro cliente aparece', async ({ page }) => {
    await mockClientesAPI(page, clientesMock);
    await page.goto('/clientes');
    await expect(page.getByText('Empresa Exemplo LTDA')).toBeVisible();
  });

  test('Given API com lista vazia, When página carrega, Then exibe mensagem de lista vazia', async ({ page }) => {
    await mockClientesAPI(page, { data: [], total: 0, page: 1, pageSize: 20 });
    await page.goto('/clientes');
    // Aguarda ausência de cards e mensagem de estado vazio
    await expect(page.locator('app-cliente-card')).toHaveCount(0);
    // Componente deve exibir algum feedback ao usuário
    const emptyMsg = page.getByText(/nenhum cliente|sem clientes|lista vazia/i);
    await expect(emptyMsg).toBeVisible();
  });

  test('Given cliente inativo, When exibido, Then badge "Inativo" é visível', async ({ page }) => {
    await mockClientesAPI(page, clientesMock);
    await page.goto('/clientes');
    await expect(page.getByText('Inativo')).toBeVisible();
  });

  test('Given cliente ativo, When link de email clicado, Then href é mailto correto', async ({ page }) => {
    await mockClientesAPI(page, clientesMock);
    await page.goto('/clientes');
    const emailLink = page.locator('a[href^="mailto:contato@empresa.com"]');
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveAttribute('href', 'mailto:contato@empresa.com');
  });

});
