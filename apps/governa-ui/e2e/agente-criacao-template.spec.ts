// ============================================================
// e2e/agente-criacao-template.spec.ts
//
// Playwright E2E — jornada de criação de agente com template (E8).
//
// Cobre os cenários Gherkin da spec §9 ponta a ponta (com backend mockado
// via page.route, no mesmo padrão de e2e/agentes.spec.ts):
//   1. Selecionar template preenche o formulário + preview
//   2. Trocar de template não sobrescreve edição manual
//   3. Preview em "Code" mostra YAML com name/model/tools
//   4. Criar agente inclui systemPrompt, mcpServers e templateId no POST
//   5. "Agente em branco" → templateId ausente (null no backend)
//
// Pré-requisitos (mesmo dos demais e2e, NÃO roda no `jest`):
//   - governa-ui em UI_URL (default http://localhost:4200)
//   - Usuário autenticado (loginE2E via endpoint mockado)
//   - Browsers do Playwright instalados (`npx playwright install`)
// ============================================================
import { test, expect, type Page, type Request } from '@playwright/test';
import { loginE2E, navigateTo } from './helpers';

// Captura o corpo do POST /agents e responde 201 com o agente criado.
async function interceptCreateAgente(page: Page): Promise<{ lastBody: () => unknown }> {
  let captured: unknown = null;

  await page.route('**/agents', (route) => {
    const req: Request = route.request();
    if (req.method() === 'POST') {
      captured = req.postDataJSON();
      const body = captured as Record<string, unknown>;
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id:           'ag-e2e-1',
            tenantId:     'tenant-tf',
            name:         body['name'] ?? 'Agente',
            description:  body['description'] ?? '',
            ownerId:      body['ownerId'] ?? 'user-1',
            policyId:     body['policyId'] ?? null,
            status:       'SANDBOX',
            modelId:      body['modelId'] ?? 'claude-sonnet-5',
            tools:        body['tools'] ?? [],
            systemPrompt: body['systemPrompt'] ?? null,
            mcpServers:   body['mcpServers'] ?? [],
            skills:       body['skills'] ?? [],
            templateId:   body['templateId'] ?? null,
            createdAt:    '2026-07-16T10:00:00Z',
            updatedAt:    '2026-07-16T10:00:00Z',
            lastActiveAt: null,
          },
        }),
      });
    } else {
      // GET /agents (lista pós-criação) → vazio
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0 }),
      });
    }
  });

  return { lastBody: () => captured };
}

test.describe('Criação de agente com template (E8)', () => {

  test.beforeEach(async ({ page }) => {
    await loginE2E(page);
  });

  test('Cenário 1: selecionar template preenche formulário e preview', async ({ page }) => {
    await interceptCreateAgente(page);
    await navigateTo(page, '/agentes/novo');

    // Passo 1: galeria de templates
    await page.getByRole('radio', { name: /Consulta de Pedidos/ }).click();

    // Passo 2: formulário pré-preenchido
    await expect(page.locator('#af-system-prompt')).toHaveValue(/consulta pedidos no Protheus/);
    await expect(page.getByText('Consultar pedido')).toBeVisible();

    // Preview reflete o template
    await page.getByRole('tab', { name: 'Code' }).click();
    await expect(page.getByLabel('Configuração do agente em YAML')).toContainText('read_protheus_pedido');
  });

  test('Cenário 2: trocar de template preserva o nome editado manualmente', async ({ page }) => {
    await interceptCreateAgente(page);
    await navigateTo(page, '/agentes/novo');

    await page.getByRole('radio', { name: /Consulta de Pedidos/ }).click();
    await page.getByLabel('Nome do agente').fill('Meu Agente Custom');

    // Volta e troca de template
    await page.getByRole('button', { name: /Trocar modelo/ }).click();
    await page.getByRole('radio', { name: /Atendimento ao Cliente/ }).click();

    await expect(page.getByLabel('Nome do agente')).toHaveValue('Meu Agente Custom');
    await expect(page.getByText('Consultar cliente')).toBeVisible();
  });

  test('Cenário 3: preview em Code contém name, model e tools', async ({ page }) => {
    await interceptCreateAgente(page);
    await navigateTo(page, '/agentes/novo');

    await page.getByRole('radio', { name: /Consulta de Pedidos/ }).click();
    await page.getByRole('tab', { name: 'Code' }).click();

    const pre = page.getByLabel('Configuração do agente em YAML');
    await expect(pre).toContainText('name:');
    await expect(pre).toContainText('model:');
    await expect(pre).toContainText('tools:');
  });

  test('Cenário 4: criar agente inclui systemPrompt, mcpServers e templateId', async ({ page }) => {
    const capture = await interceptCreateAgente(page);
    await navigateTo(page, '/agentes/novo');

    await page.getByRole('radio', { name: /Triagem de Nota Fiscal/ }).click();
    await page.getByRole('button', { name: 'Criar Agente' }).click();

    await page.waitForURL('**/agentes');

    const body = capture.lastBody() as Record<string, unknown>;
    expect(body['templateId']).toBe('triagem-nf');
    expect(typeof body['systemPrompt']).toBe('string');
    expect(Array.isArray(body['mcpServers'])).toBe(true);
    expect((body['mcpServers'] as unknown[]).length).toBeGreaterThan(0);
  });

  test('Cenário 5: "Agente em branco" cria sem templateId', async ({ page }) => {
    const capture = await interceptCreateAgente(page);
    await navigateTo(page, '/agentes/novo');

    await page.getByRole('radio', { name: /Agente em branco/ }).click();
    await page.getByLabel('Nome do agente').fill('Agente Manual');
    await page.getByRole('button', { name: 'Criar Agente' }).click();

    await page.waitForURL('**/agentes');

    const body = capture.lastBody() as Record<string, unknown>;
    expect(body['name']).toBe('Agente Manual');
    expect(body['templateId']).toBeUndefined();
  });

});
