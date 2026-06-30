import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GovSelectComponent, SelectOption } from './gov-select.component';

const OPTIONS: SelectOption[] = [
  { value: 'a', label: 'Opção A' },
  { value: 'b', label: 'Opção B' },
  { value: 'c', label: 'Opção C', disabled: true },
];

function setup(inputs: Partial<{
  label:       string;
  options:     SelectOption[];
  placeholder: string;
  hint:        string;
  error:       string;
  required:    boolean;
}> = {}) {
  TestBed.configureTestingModule({ imports: [GovSelectComponent] });
  const fixture: ComponentFixture<GovSelectComponent> = TestBed.createComponent(GovSelectComponent);
  Object.assign(fixture.componentInstance, { options: OPTIONS, ...inputs });
  fixture.detectChanges();
  const el: HTMLElement           = fixture.nativeElement;
  const select: HTMLSelectElement = el.querySelector('select')!;
  return { fixture, comp: fixture.componentInstance, el, select };
}

describe('GovSelectComponent', () => {

  it('deve criar o componente', () => {
    const { comp } = setup();
    expect(comp).toBeTruthy();
  });

  // ── Label ─────────────────────────────────────────────────────

  it('renderiza label quando fornecida', () => {
    const { el } = setup({ label: 'Status' });
    const label = el.querySelector('label');
    expect(label).not.toBeNull();
    expect(label!.textContent?.trim()).toContain('Status');
  });

  it('não renderiza label quando ausente', () => {
    const { el } = setup();
    expect(el.querySelector('label')).toBeNull();
  });

  it('label aponta para o select via htmlFor', () => {
    const { el, select } = setup({ label: 'Status' });
    const label = el.querySelector('label')!;
    expect(label.htmlFor).toBe(select.id);
  });

  // ── Options ───────────────────────────────────────────────────

  it('renderiza todas as options', () => {
    const { select } = setup();
    const opts = select.querySelectorAll('option');
    expect(opts.length).toBe(3);
  });

  it('renderiza option desabilitada quando opt.disabled=true', () => {
    const { select } = setup();
    const opts = Array.from(select.querySelectorAll('option'));
    const disabled = opts.find((o) => o.value === 'c');
    expect(disabled?.disabled).toBe(true);
  });

  // ── Placeholder ───────────────────────────────────────────────

  it('renderiza placeholder como primeira opção quando fornecido', () => {
    const { select } = setup({ placeholder: 'Selecione…' });
    const first = select.options[0];
    expect(first.textContent?.trim()).toBe('Selecione…');
    expect(first.value).toBe('');
  });

  it('não renderiza placeholder quando ausente', () => {
    const { select } = setup({ options: OPTIONS });
    const opts = Array.from(select.options);
    expect(opts.some((o) => o.value === '')).toBe(false);
  });

  // ── Hint / Error ──────────────────────────────────────────────

  it('exibe hint quando fornecido e sem error', () => {
    const { el } = setup({ hint: 'Selecione o desfecho' });
    const hint = el.querySelector('.gov-field__hint');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toContain('Selecione o desfecho');
  });

  it('exibe error span quando error fornecido', () => {
    const { el } = setup({ error: 'Campo obrigatório' });
    const errorEl = el.querySelector('.gov-field__error');
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toContain('Campo obrigatório');
  });

  it('oculta hint quando error está presente', () => {
    const { el } = setup({ hint: 'Dica', error: 'Erro' });
    expect(el.querySelector('.gov-field__hint')).toBeNull();
  });

  it('aplica gov-field--error ao wrapper quando error presente', () => {
    const { el } = setup({ error: 'Inválido' });
    expect(el.querySelector('.gov-field--error')).not.toBeNull();
  });

  it('define aria-invalid no select quando error presente', () => {
    const { select } = setup({ error: 'Inválido' });
    expect(select.getAttribute('aria-invalid')).toBe('true');
  });

  // ── Required ──────────────────────────────────────────────────

  it('exibe asterisco quando required=true', () => {
    const { el } = setup({ label: 'Status', required: true });
    expect(el.querySelector('.gov-field__required')).not.toBeNull();
  });

  // ── ControlValueAccessor — writeValue ─────────────────────────

  it('writeValue("b") seleciona a opção correta', () => {
    const { comp, select, fixture } = setup();
    comp.writeValue('b');
    fixture.detectChanges();
    expect(select.value).toBe('b');
  });

  it('writeValue(null) define valor como string vazia', () => {
    const { comp, select, fixture } = setup({ placeholder: 'Todos' });
    comp.writeValue(null);
    fixture.detectChanges();
    expect(select.value).toBe('');
  });

  // ── ControlValueAccessor — onChange ──────────────────────────

  it('onChange é chamado ao selecionar opção', () => {
    const { comp, select } = setup();
    const fn = jest.fn();
    comp.registerOnChange(fn);
    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    expect(fn).toHaveBeenCalledWith('b');
  });

  // ── ControlValueAccessor — onTouched ─────────────────────────

  it('onTouched é chamado ao sair do select (blur)', () => {
    const { comp, select } = setup();
    const fn = jest.fn();
    comp.registerOnTouched(fn);
    select.dispatchEvent(new Event('blur'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // ── ControlValueAccessor — setDisabledState ───────────────────

  it('setDisabledState(true) desabilita o select', () => {
    const { comp, select, fixture } = setup();
    comp.setDisabledState(true);
    fixture.detectChanges();
    expect(select.disabled).toBe(true);
  });

  it('setDisabledState(false) reabilita o select', () => {
    const { comp, select, fixture } = setup();
    comp.setDisabledState(true);
    fixture.detectChanges();
    comp.setDisabledState(false);
    fixture.detectChanges();
    expect(select.disabled).toBe(false);
  });
});
