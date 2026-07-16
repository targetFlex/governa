// ============================================================
// agente-config-preview.component.spec.ts
//
// Suites:
//   1. Pretty (default) — resumo legível
//   2. Code — bloco YAML read-only com aria-label
//   3. Toggle Pretty/Code
//   4. Copiar (usa navigator.clipboard)
// ============================================================

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgenteConfigPreviewComponent } from './agente-config-preview.component';
import { AgentConfig } from '../agente-form.utils';

const config: AgentConfig = {
  name:        'Agente de Pedidos',
  model:       'claude-sonnet-5',
  description: 'Consulta pedidos',
  system:      'Você consulta pedidos.',
  tools:       ['read_protheus_pedido'],
  skills:      [],
  mcpServers:  [{ id: 'protheus-rest', name: 'Protheus REST' }],
  policy:      null,
  template:    'consulta-pedidos',
};

const yaml = 'name: "Agente de Pedidos"\nmodel: "claude-sonnet-5"\ntools:\n  - "read_protheus_pedido"';

function setup(): {
  fixture: ComponentFixture<AgenteConfigPreviewComponent>;
  comp: AgenteConfigPreviewComponent;
  el: HTMLElement;
} {
  TestBed.configureTestingModule({ imports: [AgenteConfigPreviewComponent] });
  const fixture = TestBed.createComponent(AgenteConfigPreviewComponent);
  fixture.componentInstance.config = config;
  fixture.componentInstance.yaml = yaml;
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement };
}

describe('AgenteConfigPreviewComponent — Pretty (default)', () => {

  it('inicia no modo Pretty exibindo os valores', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Agente de Pedidos');
    expect(el.textContent).toContain('claude-sonnet-5');
    expect(el.textContent).toContain('read_protheus_pedido');
    // não há bloco de código no modo Pretty
    expect(el.querySelector('.acp__code')).toBeNull();
  });

  it('toggle Pretty/Code tem role tablist/tab', () => {
    const { el } = setup();
    expect(el.querySelector('[role="tablist"]')).not.toBeNull();
    expect(el.querySelectorAll('[role="tab"]').length).toBe(2);
  });

});

describe('AgenteConfigPreviewComponent — Code', () => {

  it('exibe o YAML em <pre> com aria-label ao alternar para Code', () => {
    const { fixture, comp, el } = setup();
    comp.setMode('code');
    fixture.detectChanges();

    const pre = el.querySelector('.acp__code');
    expect(pre).not.toBeNull();
    expect(pre!.getAttribute('aria-label')).toBe('Configuração do agente em YAML');
    expect(pre!.getAttribute('tabindex')).toBe('0');
    expect(pre!.textContent).toContain('read_protheus_pedido');
  });

});

describe('AgenteConfigPreviewComponent — copiar', () => {

  afterEach(() => {
    // restaura clipboard entre testes
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('copy() escreve o YAML no clipboard e marca "copiado"', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const { comp } = setup();
    comp.copy();

    expect(writeText).toHaveBeenCalledWith(yaml);
    await Promise.resolve(); // deixa o .then(done) resolver
    expect(comp['copied']()).toBe(true);
  });

  it('copy() reseta o estado "copiado" após o timeout', () => {
    jest.useFakeTimers();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const { comp } = setup();
    comp['copied'].set(true);
    // aciona o caminho sem clipboard para chamar done() de forma síncrona
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    comp.copy();
    expect(comp['copied']()).toBe(true);

    jest.advanceTimersByTime(2000);
    expect(comp['copied']()).toBe(false);
    jest.useRealTimers();
  });

  it('copy() usa fallback quando clipboard não está disponível', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const { comp } = setup();

    expect(() => comp.copy()).not.toThrow();
    expect(comp['copied']()).toBe(true);
  });

  it('copy() não lança quando writeText rejeita', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('sem permissão'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const { comp } = setup();
    expect(() => comp.copy()).not.toThrow();
    await Promise.resolve();
    expect(comp['copied']()).toBe(false);
  });

});

describe('AgenteConfigPreviewComponent — toggle', () => {

  it('alterna Code → Pretty de volta', () => {
    const { fixture, comp, el } = setup();
    comp.setMode('code');
    fixture.detectChanges();
    expect(el.querySelector('.acp__code')).not.toBeNull();

    comp.setMode('pretty');
    fixture.detectChanges();
    expect(el.querySelector('.acp__code')).toBeNull();
  });

});
