import { type Page } from '@playwright/test';

/**
 * Autentica via formulário de login com endpoint mockado.
 * O AuthService usa Signal em memória — não localStorage — portanto
 * a única forma de injetar o token é passar pelo fluxo de login real.
 */
export async function loginE2E(page: Page): Promise<void> {
  await page.route('**/auth/login**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'e2e-test-token', expiresIn: 3600 }),
    }),
  );
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('e2e@governa.test');
  await page.getByLabel('Senha').fill('senha123456');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/dashboard**');
}

/**
 * Navega para `path` via roteamento client-side do Angular,
 * preservando o Signal de autenticação em memória.
 *
 * Usa o link da sidebar quando disponível; caso contrário,
 * dispara pushState + popstate para que o Router do Angular processe.
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  const sidebarLink = page.locator(`a.sidebar__link[href="${path}"]`);
  if ((await sidebarLink.count()) > 0) {
    await sidebarLink.click();
  } else {
    await page.evaluate((p) => {
      window.history.pushState({}, '', p);
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    }, path);
  }
  await page.waitForURL(`**${path}`);
}
