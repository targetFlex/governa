import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GovButtonComponent, ButtonVariant, ButtonSize } from './gov-button.component';

function setup(inputs: Partial<{
  variant: ButtonVariant;
  size: ButtonSize;
  type: 'button' | 'submit' | 'reset';
  disabled: boolean;
  loading: boolean;
  fullWidth: boolean;
  ariaLabel: string;
}> = {}) {
  TestBed.configureTestingModule({ imports: [GovButtonComponent] });
  const fixture: ComponentFixture<GovButtonComponent> = TestBed.createComponent(GovButtonComponent);
  Object.assign(fixture.componentInstance, inputs);
  fixture.detectChanges();
  const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
  return { fixture, comp: fixture.componentInstance, btn };
}

describe('GovButtonComponent', () => {

  it('deve criar o componente', () => {
    const { comp } = setup();
    expect(comp).toBeTruthy();
  });

  // ── Variant ──────────────────────────────────────────────────

  it('variant padrão é primary', () => {
    const { btn } = setup();
    expect(btn.classList).toContain('gov-btn--primary');
  });

  it.each<ButtonVariant>(['primary', 'secondary', 'ghost', 'danger'])(
    'aplica gov-btn--%s para variant=%s',
    (variant) => {
      const { btn } = setup({ variant });
      expect(btn.classList).toContain(`gov-btn--${variant}`);
    },
  );

  // ── Size ─────────────────────────────────────────────────────

  it('size padrão é md', () => {
    const { btn } = setup();
    expect(btn.classList).toContain('gov-btn--md');
  });

  it.each<ButtonSize>(['sm', 'md', 'lg'])(
    'aplica gov-btn--%s para size=%s',
    (size) => {
      const { btn } = setup({ size });
      expect(btn.classList).toContain(`gov-btn--${size}`);
    },
  );

  // ── Type ─────────────────────────────────────────────────────

  it('type padrão é button', () => {
    const { btn } = setup();
    expect(btn.type).toBe('button');
  });

  it('aplica type=submit quando configurado', () => {
    const { btn } = setup({ type: 'submit' });
    expect(btn.type).toBe('submit');
  });

  // ── disabled ─────────────────────────────────────────────────

  it('fica disabled quando disabled=true', () => {
    const { btn } = setup({ disabled: true });
    expect(btn.disabled).toBe(true);
  });

  it('fica disabled quando loading=true', () => {
    const { btn } = setup({ loading: true });
    expect(btn.disabled).toBe(true);
  });

  it('não fica disabled por padrão', () => {
    const { btn } = setup();
    expect(btn.disabled).toBe(false);
  });

  // ── Loading ──────────────────────────────────────────────────

  it('exibe spinner quando loading=true', () => {
    const { fixture } = setup({ loading: true });
    const spinner = fixture.nativeElement.querySelector('.gov-btn__spinner');
    expect(spinner).not.toBeNull();
  });

  it('não exibe spinner quando loading=false', () => {
    const { fixture } = setup({ loading: false });
    const spinner = fixture.nativeElement.querySelector('.gov-btn__spinner');
    expect(spinner).toBeNull();
  });

  it('define aria-busy quando loading=true', () => {
    const { btn } = setup({ loading: true });
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('não define aria-busy quando loading=false', () => {
    const { btn } = setup({ loading: false });
    expect(btn.getAttribute('aria-busy')).toBeNull();
  });

  // ── fullWidth ────────────────────────────────────────────────

  it('aplica gov-btn--full-width quando fullWidth=true', () => {
    const { btn } = setup({ fullWidth: true });
    expect(btn.classList).toContain('gov-btn--full-width');
  });

  it('não aplica gov-btn--full-width por padrão', () => {
    const { btn } = setup();
    expect(btn.classList).not.toContain('gov-btn--full-width');
  });

  // ── ariaLabel ────────────────────────────────────────────────

  it('define aria-label quando fornecido', () => {
    const { btn } = setup({ ariaLabel: 'Salvar política' });
    expect(btn.getAttribute('aria-label')).toBe('Salvar política');
  });

  it('não define aria-label quando ausente', () => {
    const { btn } = setup();
    expect(btn.getAttribute('aria-label')).toBeNull();
  });

  // ── clicked EventEmitter ──────────────────────────────────────

  it('emite clicked ao clicar no botão', () => {
    const { fixture, btn } = setup();
    const spy = jest.fn();
    fixture.componentInstance.clicked.subscribe(spy);
    btn.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('não emite clicked quando disabled=true', () => {
    const { fixture, btn } = setup({ disabled: true });
    const spy = jest.fn();
    fixture.componentInstance.clicked.subscribe(spy);
    btn.click();
    expect(spy).not.toHaveBeenCalled();
  });
});
