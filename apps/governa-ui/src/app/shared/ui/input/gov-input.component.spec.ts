import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GovInputComponent } from './gov-input.component';

function setup(inputs: Partial<{
  label: string;
  type: string;
  placeholder: string;
  hint: string;
  error: string;
  required: boolean;
  autocomplete: string;
}> = {}) {
  TestBed.configureTestingModule({ imports: [GovInputComponent] });
  const fixture: ComponentFixture<GovInputComponent> = TestBed.createComponent(GovInputComponent);
  Object.assign(fixture.componentInstance, inputs);
  fixture.detectChanges();
  const el: HTMLElement         = fixture.nativeElement;
  const input: HTMLInputElement = el.querySelector('input')!;
  return { fixture, comp: fixture.componentInstance, el, input };
}

describe('GovInputComponent', () => {

  it('deve criar o componente', () => {
    const { comp } = setup();
    expect(comp).toBeTruthy();
  });

  // ── Label ─────────────────────────────────────────────────────

  it('renderiza label quando fornecida', () => {
    const { el } = setup({ label: 'E-mail' });
    const label = el.querySelector('label');
    expect(label).not.toBeNull();
    expect(label!.textContent?.trim()).toContain('E-mail');
  });

  it('não renderiza label quando ausente', () => {
    const { el } = setup();
    expect(el.querySelector('label')).toBeNull();
  });

  it('label aponta para o input via htmlFor', () => {
    const { el } = setup({ label: 'Nome' });
    const label = el.querySelector('label')!;
    const input = el.querySelector('input')!;
    expect(label.htmlFor).toBe(input.id);
  });

  // ── Required ──────────────────────────────────────────────────

  it('exibe asterisco quando required=true', () => {
    const { el } = setup({ label: 'Campo', required: true });
    const star = el.querySelector('.gov-field__required');
    expect(star).not.toBeNull();
  });

  it('não exibe asterisco quando required=false', () => {
    const { el } = setup({ label: 'Campo' });
    const star = el.querySelector('.gov-field__required');
    expect(star).toBeNull();
  });

  it('define aria-required no input quando required=true', () => {
    const { input } = setup({ required: true });
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  // ── Hint ──────────────────────────────────────────────────────

  it('exibe hint quando fornecido e sem error', () => {
    const { el } = setup({ hint: 'Dica aqui' });
    const hint = el.querySelector('.gov-field__hint');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toContain('Dica aqui');
  });

  it('oculta hint quando error está presente', () => {
    const { el } = setup({ hint: 'Dica aqui', error: 'Campo obrigatório' });
    expect(el.querySelector('.gov-field__hint')).toBeNull();
  });

  // ── Error ─────────────────────────────────────────────────────

  it('exibe span de error quando error fornecido', () => {
    const { el } = setup({ error: 'Campo obrigatório' });
    const errorEl = el.querySelector('.gov-field__error');
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toContain('Campo obrigatório');
  });

  it('não exibe error span quando error ausente', () => {
    const { el } = setup();
    expect(el.querySelector('.gov-field__error')).toBeNull();
  });

  it('aplica gov-field--error ao wrapper quando error presente', () => {
    const { el } = setup({ error: 'Inválido' });
    expect(el.querySelector('.gov-field--error')).not.toBeNull();
  });

  it('define aria-invalid no input quando error presente', () => {
    const { input } = setup({ error: 'Inválido' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('não define aria-invalid quando sem error', () => {
    const { input } = setup();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('error span tem role=alert', () => {
    const { el } = setup({ error: 'Erro' });
    const errorEl = el.querySelector('.gov-field__error');
    expect(errorEl!.getAttribute('role')).toBe('alert');
  });

  // ── ControlValueAccessor — writeValue ─────────────────────────

  it('writeValue("abc") atualiza o valor do input', () => {
    const { comp, input, fixture } = setup();
    comp.writeValue('abc');
    fixture.detectChanges();
    expect(input.value).toBe('abc');
  });

  it('writeValue(null) define valor como string vazia', () => {
    const { comp, input, fixture } = setup();
    comp.writeValue(null);
    fixture.detectChanges();
    expect(input.value).toBe('');
  });

  // ── ControlValueAccessor — onChange ──────────────────────────

  it('onChange é chamado ao digitar no input', () => {
    const { comp, input } = setup();
    const fn = jest.fn();
    comp.registerOnChange(fn);
    input.value = 'teste';
    input.dispatchEvent(new Event('input'));
    expect(fn).toHaveBeenCalledWith('teste');
  });

  // ── ControlValueAccessor — onTouched ─────────────────────────

  it('onTouched é chamado ao sair do input (blur)', () => {
    const { comp, input } = setup();
    const fn = jest.fn();
    comp.registerOnTouched(fn);
    input.dispatchEvent(new Event('blur'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // ── ControlValueAccessor — setDisabledState ───────────────────

  it('setDisabledState(true) desabilita o input', () => {
    const { comp, input, fixture } = setup();
    comp.setDisabledState(true);
    fixture.detectChanges();
    expect(input.disabled).toBe(true);
  });

  it('setDisabledState(false) reabilita o input', () => {
    const { comp, input, fixture } = setup();
    comp.setDisabledState(true);
    fixture.detectChanges();
    comp.setDisabledState(false);
    fixture.detectChanges();
    expect(input.disabled).toBe(false);
  });

  // ── aria-describedby ─────────────────────────────────────────

  it('define aria-describedby quando hint presente', () => {
    const { input } = setup({ hint: 'Dica' });
    expect(input.getAttribute('aria-describedby')).not.toBeNull();
  });

  it('define aria-describedby quando error presente', () => {
    const { input } = setup({ error: 'Erro' });
    expect(input.getAttribute('aria-describedby')).not.toBeNull();
  });

  it('não define aria-describedby quando nem hint nem error', () => {
    const { input } = setup();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });
});
