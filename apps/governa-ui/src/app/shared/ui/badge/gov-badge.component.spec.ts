import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GovBadgeComponent, BadgeVariant, BadgeSize } from './gov-badge.component';

function setup(inputs: Partial<{ variant: BadgeVariant; size: BadgeSize; ariaLabel: string }> = {}) {
  TestBed.configureTestingModule({ imports: [GovBadgeComponent] });
  const fixture: ComponentFixture<GovBadgeComponent> = TestBed.createComponent(GovBadgeComponent);
  Object.assign(fixture.componentInstance, inputs);
  fixture.detectChanges();
  const span: HTMLElement = fixture.nativeElement.querySelector('.gov-badge');
  return { fixture, comp: fixture.componentInstance, span };
}

describe('GovBadgeComponent', () => {

  it('deve criar o componente', () => {
    const { comp } = setup();
    expect(comp).toBeTruthy();
  });

  it('variant padrão é primary', () => {
    const { span } = setup();
    expect(span.classList).toContain('gov-badge--primary');
  });

  it.each<BadgeVariant>(['primary', 'success', 'warning', 'error', 'neutral'])(
    'aplica gov-badge--%s para variant=%s',
    (variant) => {
      const { span } = setup({ variant });
      expect(span.classList).toContain(`gov-badge--${variant}`);
    },
  );

  it('size padrão é sm', () => {
    const { span } = setup();
    expect(span.classList).toContain('gov-badge--sm');
  });

  it('aplica gov-badge--md para size=md', () => {
    const { span } = setup({ size: 'md' });
    expect(span.classList).toContain('gov-badge--md');
  });

  it('define aria-label quando fornecido', () => {
    const { span } = setup({ ariaLabel: 'Status: ativo' });
    expect(span.getAttribute('aria-label')).toBe('Status: ativo');
  });

  it('não define aria-label quando ausente', () => {
    const { span } = setup();
    expect(span.getAttribute('aria-label')).toBeNull();
  });
});
