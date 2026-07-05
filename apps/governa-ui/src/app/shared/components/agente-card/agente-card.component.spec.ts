// ============================================================
// agente-card.component.spec.ts
//
// TDD — Given/When/Then
// Suites:
//   1. Renderização por status (badge + visibilidade de botões)
//   2. Interações de ações (emissão de outputs)
//   3. Estado emAndamento (spinner + disabled)
//   4. Acessibilidade WCAG 2.1 AA (jest-axe)
// ============================================================
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AgenteCardComponent } from './agente-card.component';
import { Agente } from '../../models/agente.model';

expect.extend(toHaveNoViolations);

// ── Fixtures ─────────────────────────────────────────────────

const baseAgente: Agente = {
  id:           'agente-1',
  tenantId:     'tenant-abc',
  name:         'Agente de Atendimento',
  description:  'Responde consultas de pedidos via Protheus',
  ownerId:      'user-1',
  policyId:     'policy-1',
  status:       'ACTIVE',
  modelId:      'claude-sonnet-4',
  tools:        ['read_protheus_pedido', 'read_protheus_cliente'],
  createdAt:    '2026-05-01T10:00:00Z',
  updatedAt:    '2026-06-01T08:00:00Z',
  lastActiveAt: '2026-06-13T14:30:00Z',
};

function makeAgente(overrides: Partial<Agente> = {}): Agente {
  return { ...baseAgente, ...overrides };
}

function setup(agente: Agente, emAndamento = false): ComponentFixture<AgenteCardComponent> {
  TestBed.configureTestingModule({
    imports: [AgenteCardComponent, RouterTestingModule],
  });
  const fixture = TestBed.createComponent(AgenteCardComponent);
  fixture.componentInstance.agente = agente;
  fixture.componentInstance.emAndamento = emAndamento;
  fixture.detectChanges();
  return fixture;
}

// ── Suite 1: Renderização por status ─────────────────────────

describe('AgenteCardComponent — renderização por status', () => {

  it('ACTIVE: exibe badge "Ativo" e botão Pausar, sem botão Ativar', () => {
    // Given: agente com status ACTIVE
    const fixture = setup(makeAgente({ status: 'ACTIVE' }));
    const el: HTMLElement = fixture.nativeElement;

    // Then: badge correto
    expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('Ativo');
    // Then: botão Pausar visível
    expect(el.querySelector('.agente-card__btn--pausar')).toBeTruthy();
    // Then: botão Ativar ausente
    expect(el.querySelector('.agente-card__btn--ativar')).toBeNull();
  });

  it('PAUSED: exibe badge "Pausado" e botão Ativar, sem botão Pausar', () => {
    // Given: agente com status PAUSED e policyId configurada
    const fixture = setup(makeAgente({ status: 'PAUSED' }));
    const el: HTMLElement = fixture.nativeElement;

    // Then
    expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('Pausado');
    expect(el.querySelector('.agente-card__btn--ativar')).toBeTruthy();
    expect(el.querySelector('.agente-card__btn--pausar')).toBeNull();
  });

  it('SANDBOX: exibe badge "Sandbox" e botão Ativar, sem botão Pausar', () => {
    // Given
    const fixture = setup(makeAgente({ status: 'SANDBOX', policyId: 'p-1' }));
    const el: HTMLElement = fixture.nativeElement;

    // Then
    expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('Sandbox');
    expect(el.querySelector('.agente-card__btn--ativar')).toBeTruthy();
    expect(el.querySelector('.agente-card__btn--pausar')).toBeNull();
  });

  it('DEPRECATED: exibe badge "Depreciado" e não renderiza nenhum botão', () => {
    // Given
    const fixture = setup(makeAgente({ status: 'DEPRECATED' }));
    const el: HTMLElement = fixture.nativeElement;

    // Then
    expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('Depreciado');
    expect(el.querySelector('.agente-card__footer')).toBeNull();
  });

  it('exibe nome e descrição do agente', () => {
    // Given
    const fixture = setup(makeAgente({ name: 'Meu Agente', description: 'Faz coisas legais' }));
    const el: HTMLElement = fixture.nativeElement;

    // Then
    expect(el.querySelector('.agente-card__nome')?.textContent?.trim()).toBe('Meu Agente');
    expect(el.querySelector('.agente-card__descricao')?.textContent?.trim()).toBe('Faz coisas legais');
  });

  it('exibe contagem correta de tools', () => {
    // Given: agente com 3 tools
    const fixture = setup(makeAgente({ tools: ['t1', 't2', 't3'] }));
    const el: HTMLElement = fixture.nativeElement;

    // Then
    const rows = el.querySelectorAll('.agente-card__row');
    const toolsRow = Array.from(rows).find((r) =>
      r.querySelector('dt')?.textContent?.trim() === 'Tools',
    );
    expect(toolsRow?.querySelector('dd')?.textContent?.trim()).toBe('3 configuradas');
  });

  it('botão Ativar fica desabilitado quando policyId é null', () => {
    // Given: agente PAUSED sem política
    const fixture = setup(makeAgente({ status: 'PAUSED', policyId: null }));
    const el: HTMLElement = fixture.nativeElement;

    // Then: botão presente mas desabilitado
    const btn = el.querySelector<HTMLButtonElement>('.agente-card__btn--ativar');
    expect(btn).toBeTruthy();
    expect(btn?.disabled).toBe(true);
  });

});

// ── Suite 2: Interações ──────────────────────────────────────

describe('AgenteCardComponent — interações', () => {

  it('emite pausar com id correto ao clicar em Pausar', () => {
    // Given
    const agente = makeAgente({ status: 'ACTIVE', id: 'ag-99' });
    const fixture = setup(agente);
    const emitted: string[] = [];
    fixture.componentInstance.pausar.subscribe((id: string) => emitted.push(id));

    // When
    const btn = fixture.nativeElement.querySelector<HTMLButtonElement>('.agente-card__btn--pausar');
    btn?.click();

    // Then
    expect(emitted).toEqual(['ag-99']);
  });

  it('emite ativar com id correto ao clicar em Ativar', () => {
    // Given
    const agente = makeAgente({ status: 'PAUSED', id: 'ag-42', policyId: 'p-1' });
    const fixture = setup(agente);
    const emitted: string[] = [];
    fixture.componentInstance.ativar.subscribe((id: string) => emitted.push(id));

    // When
    fixture.nativeElement.querySelector<HTMLButtonElement>('.agente-card__btn--ativar')?.click();

    // Then
    expect(emitted).toEqual(['ag-42']);
  });

  it('não emite ativar quando policyId é null', () => {
    // Given: PAUSED sem política — botão desabilitado
    const agente = makeAgente({ status: 'PAUSED', policyId: null });
    const fixture = setup(agente);
    const emitted: string[] = [];
    fixture.componentInstance.ativar.subscribe((id: string) => emitted.push(id));

    // When: tenta clicar
    fixture.nativeElement.querySelector<HTMLButtonElement>('.agente-card__btn--ativar')?.click();

    // Then: nada emitido
    expect(emitted).toHaveLength(0);
  });

});

// ── Suite 3: Estado emAndamento ──────────────────────────────

describe('AgenteCardComponent — emAndamento', () => {

  it('botão Pausar fica disabled e exibe texto "Pausando…" durante ação', () => {
    // Given: emAndamento = true
    const fixture = setup(makeAgente({ status: 'ACTIVE' }), true);
    const btn = fixture.nativeElement.querySelector<HTMLButtonElement>('.agente-card__btn--pausar');

    // Then
    expect(btn?.disabled).toBe(true);
    expect(btn?.textContent?.trim()).toContain('Pausando');
    expect(btn?.getAttribute('aria-busy')).toBe('true');
  });

  it('botão Ativar fica disabled e exibe texto "Ativando…" durante ação', () => {
    // Given
    const fixture = setup(makeAgente({ status: 'PAUSED', policyId: 'p-1' }), true);
    const btn = fixture.nativeElement.querySelector<HTMLButtonElement>('.agente-card__btn--ativar');

    // Then
    expect(btn?.disabled).toBe(true);
    expect(btn?.textContent?.trim()).toContain('Ativando');
  });

  it('spinner é renderizado durante ação em andamento', () => {
    // Given
    const fixture = setup(makeAgente({ status: 'ACTIVE' }), true);

    // Then
    expect(fixture.nativeElement.querySelector('.agente-card__spinner')).toBeTruthy();
  });

});

// ── Suite 4: Acessibilidade ──────────────────────────────────

describe('AgenteCardComponent — acessibilidade (WCAG 2.1 AA)', () => {

  it('agente ACTIVE não tem violações de acessibilidade', async () => {
    const fixture = setup(makeAgente({ status: 'ACTIVE' }));
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });

  it('agente DEPRECATED não tem violações de acessibilidade', async () => {
    const fixture = setup(makeAgente({ status: 'DEPRECATED' }));
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });

  it('agente PAUSED sem política não tem violações de acessibilidade', async () => {
    const fixture = setup(makeAgente({ status: 'PAUSED', policyId: null }));
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });

});
