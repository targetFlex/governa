// ============================================================
// agente-starting-point.component.spec.ts
//
// Suites:
//   1. Renderização (tabs, galeria, roles ARIA)
//   2. Seleção (emite templateSelect)
//   3. Estado selecionado (aria-checked / destaque)
//   4. Acessibilidade de teclado (navegação por setas)
// ============================================================

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgenteStartingPointComponent } from './agente-starting-point.component';
import { TEMPLATES } from '../agente-templates.data';

function setup(): {
  fixture: ComponentFixture<AgenteStartingPointComponent>;
  comp: AgenteStartingPointComponent;
  el: HTMLElement;
} {
  TestBed.configureTestingModule({ imports: [AgenteStartingPointComponent] });
  const fixture = TestBed.createComponent(AgenteStartingPointComponent);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement };
}

describe('AgenteStartingPointComponent — renderização', () => {

  it('exibe um card por template', () => {
    const { el } = setup();
    const cards = el.querySelectorAll('[role="radio"]');
    expect(cards.length).toBe(TEMPLATES.length);
  });

  it('galeria tem role="radiogroup"', () => {
    const { el } = setup();
    expect(el.querySelector('[role="radiogroup"]')).not.toBeNull();
  });

  it('tab "Descrever seu agente" está desabilitada (fase 2)', () => {
    const { el } = setup();
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const descrever = tabs.find((t) => t.textContent?.includes('Descrever'));
    expect(descrever).toBeDefined();
    expect(descrever!.disabled).toBe(true);
  });

});

describe('AgenteStartingPointComponent — seleção', () => {

  it('emite templateSelect com o template ao clicar no card', () => {
    const { fixture, comp, el } = setup();
    const emitted: string[] = [];
    comp.templateSelect.subscribe((t) => emitted.push(t.id));

    const firstCard = el.querySelector<HTMLButtonElement>('[role="radio"]')!;
    firstCard.click();
    fixture.detectChanges();

    expect(emitted).toEqual([TEMPLATES[0].id]);
  });

});

describe('AgenteStartingPointComponent — estado selecionado', () => {

  it('marca aria-checked no card selecionado', () => {
    const { fixture, el } = setup();
    fixture.componentRef.setInput('selectedTemplateId', TEMPLATES[1].id);
    fixture.detectChanges();

    const cards = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(cards[1].getAttribute('aria-checked')).toBe('true');
    expect(cards[0].getAttribute('aria-checked')).toBe('false');
    // roving tabindex: selecionado é focável
    expect(cards[1].getAttribute('tabindex')).toBe('0');
    expect(cards[0].getAttribute('tabindex')).toBe('-1');
  });

});

describe('AgenteStartingPointComponent — teclado', () => {

  it('ArrowRight move o foco para o próximo card', () => {
    const { el } = setup();
    const cards = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    cards[0].focus();

    cards[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(document.activeElement).toBe(cards[1]);
  });

  it('ArrowLeft no primeiro card volta para o último (wrap)', () => {
    const { el } = setup();
    const cards = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    cards[0].focus();

    cards[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(document.activeElement).toBe(cards[cards.length - 1]);
  });

  it('tecla não-navegacional não move o foco', () => {
    const { el } = setup();
    const cards = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    cards[0].focus();

    cards[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    expect(document.activeElement).toBe(cards[0]);
  });

});
