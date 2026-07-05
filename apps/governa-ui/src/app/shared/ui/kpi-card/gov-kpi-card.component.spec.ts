import { TestBed } from '@angular/core/testing';
import { GovKpiCardComponent } from './gov-kpi-card.component';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  imports: [GovKpiCardComponent],
  template: `
    <gov-kpi-card
      [label]="label"
      [value]="value"
      [svgPath]="svgPath"
      [variant]="variant"
      [ariaLabel]="ariaLabel"
    />
  `,
})
class TestHostComponent {
  label    = 'Agentes Ativos';
  value: string | number = 3;
  svgPath  = 'M12 6v6h4.5';
  variant: GovKpiCardComponent['variant'] = 'default';
  ariaLabel?: string;
}

describe('GovKpiCardComponent', () => {
  function getArticle(): HTMLElement {
    return document.querySelector('article.kpi')!;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
    });
  });

  it('deve renderizar o valor e o label', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.kpi__value')?.textContent?.trim()).toBe('3');
    expect(el.querySelector('.kpi__label')?.textContent?.trim()).toBe('Agentes Ativos');
  });

  it('deve aplicar a classe de variant', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.variant = 'danger';
    fixture.detectChanges();
    expect(getArticle().classList).toContain('kpi--danger');
  });

  it('deve usar ariaLabel customizado quando fornecido', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.ariaLabel = 'Custom label';
    fixture.detectChanges();
    expect(getArticle().getAttribute('aria-label')).toBe('Custom label');
  });

  it('deve gerar aria-label automático (label + value) quando ariaLabel não fornecido', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(getArticle().getAttribute('aria-label')).toBe('Agentes Ativos: 3');
  });

  it('deve aceitar value do tipo string', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.value = 'N/A';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.kpi__value')?.textContent?.trim()).toBe('N/A');
  });

  it('deve renderizar variantes: success, warning, danger', () => {
    const variants: GovKpiCardComponent['variant'][] = ['success', 'warning', 'danger'];
    for (const variant of variants) {
      const fixture = TestBed.createComponent(TestHostComponent);
      fixture.componentInstance.variant = variant;
      fixture.detectChanges();
      expect(getArticle().classList).toContain(`kpi--${variant}`);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [TestHostComponent] });
    }
  });
});
