import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from './dashboard.service';
import { GovKpiCardComponent, KpiVariant } from '../../shared/ui/kpi-card/gov-kpi-card.component';
import { GovBadgeComponent, BadgeVariant } from '../../shared/ui/badge/gov-badge.component';
import { Alert, AlertSeverity, KIND_LABELS, SEVERITY_LABELS } from '../../shared/models/alertas.model';
import { AuditEvent, Outcome, OUTCOME_LABELS } from '../../shared/models/auditoria.model';

// ── Mapeamentos de badge ──────────────────────────────────────

const OUTCOME_BADGE: Record<Outcome, BadgeVariant> = {
  EXECUTADO:  'success',
  BLOQUEADO:  'error',
  AGUARDANDO: 'warning',
  ESCALADO:   'warning',
  ERRO:       'neutral',
};

const SEVERITY_BADGE: Record<AlertSeverity, BadgeVariant> = {
  CRITICAL: 'error',
  HIGH:     'warning',
  MEDIUM:   'warning',
  LOW:      'neutral',
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1,
};

// ── SVG paths ────────────────────────────────────────────────

const ICON_AGENTES   = 'M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z';
const ICON_ALERTAS   = 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0';
const ICON_DECISOES  = 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z';
const ICON_BLOQUEADO = 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 10c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z';

@Component({
  selector: 'gov-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, GovKpiCardComponent, GovBadgeComponent],
  template: `
    <main class="cockpit" role="main">

      <!-- ── Erro ─────────────────────────────────────────────── -->
      @if (error()) {
        <div class="cockpit__error" role="alert" aria-live="assertive">
          <span>{{ error() }}</span>
          <button type="button" aria-label="Tentar novamente" (click)="load()">
            Tentar novamente
          </button>
        </div>
      }

      <!-- ── KPI Cards ─────────────────────────────────────────── -->
      @if (loading()) {
        <div class="cockpit__kpi-grid" aria-busy="true" aria-live="polite">
          @for (_ of skeletons; track $index) {
            <div class="cockpit__kpi-skeleton" aria-hidden="true"></div>
          }
          <span class="sr-only">Carregando dados do cockpit…</span>
        </div>
      } @else {
        <div class="cockpit__kpi-grid">
          <gov-kpi-card
            label="Agentes Ativos"
            [value]="agentesAtivos()"
            [svgPath]="iconAgentes"
            variant="success"
          />
          <gov-kpi-card
            label="Alertas Abertos"
            [value]="alertasAbertos()"
            [svgPath]="iconAlertas"
            [variant]="alertasAbertos() > 0 ? 'danger' : 'default'"
          />
          <gov-kpi-card
            label="Total de Decisões"
            [value]="totalDecisoes()"
            [svgPath]="iconDecisoes"
            variant="default"
          />
          <gov-kpi-card
            label="Ações Bloqueadas"
            [value]="totalBloqueados()"
            [svgPath]="iconBloqueado"
            [variant]="totalBloqueados() > 0 ? 'warning' : 'default'"
          />
        </div>
      }

      <!-- ── Últimas Decisões ──────────────────────────────────── -->
      <section class="cockpit__section" aria-labelledby="sec-decisoes">
        <div class="cockpit__section-header">
          <h2 id="sec-decisoes" class="cockpit__section-title">Últimas Decisões</h2>
          <a routerLink="/auditoria" class="cockpit__ver-mais" aria-label="Ver auditoria completa">
            Ver todas →
          </a>
        </div>

        @if (loading()) {
          <div class="cockpit__table-skeleton" aria-hidden="true"></div>
        } @else if (eventosRecentes().length === 0) {
          <p class="cockpit__empty">Nenhuma decisão registrada.</p>
        } @else {
          <div class="cockpit__table-wrap" role="region" aria-labelledby="sec-decisoes" tabindex="0">
            <table class="cockpit__table" aria-describedby="sec-decisoes">
              <caption class="sr-only">Últimas decisões dos agentes</caption>
              <thead>
                <tr>
                  <th scope="col">Data/Hora</th>
                  <th scope="col">Agente</th>
                  <th scope="col">Ação</th>
                  <th scope="col">Desfecho</th>
                  <th scope="col">Latência</th>
                </tr>
              </thead>
              <tbody>
                @for (ev of eventosRecentes(); track ev.id) {
                  <tr>
                    <td class="cockpit__td--mono">
                      {{ ev.createdAt | date: 'dd/MM/yy HH:mm' }}
                    </td>
                    <td class="cockpit__td--mono">
                      <a [routerLink]="['/agentes', ev.agentId]" class="cockpit__id-link">
                        {{ ev.agentId | slice:0:8 }}…
                      </a>
                    </td>
                    <td>{{ ev.action }}</td>
                    <td>
                      <gov-badge [variant]="outcomeBadge(ev.outcome)" size="sm">
                        {{ outcomeLabel(ev.outcome) }}
                      </gov-badge>
                    </td>
                    <td class="cockpit__td--num">{{ ev.latencyMs }} ms</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- ── Alertas Abertos ───────────────────────────────────── -->
      <section class="cockpit__section" aria-labelledby="sec-alertas">
        <div class="cockpit__section-header">
          <h2 id="sec-alertas" class="cockpit__section-title">Alertas Abertos</h2>
          <a routerLink="/alertas" class="cockpit__ver-mais" aria-label="Ver todos os alertas">
            Ver todos →
          </a>
        </div>

        @if (loading()) {
          <div class="cockpit__table-skeleton" aria-hidden="true"></div>
        } @else if (alertasSorted().length === 0) {
          <p class="cockpit__empty">Nenhum alerta aberto.</p>
        } @else {
          <div class="cockpit__table-wrap" role="region" aria-labelledby="sec-alertas" tabindex="0">
            <table class="cockpit__table">
              <caption class="sr-only">Top alertas abertos por severidade</caption>
              <thead>
                <tr>
                  <th scope="col">Agente</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Severidade</th>
                  <th scope="col">Mensagem</th>
                  <th scope="col">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                @for (al of alertasSorted(); track al.id) {
                  <tr>
                    <td class="cockpit__td--mono">
                      <a [routerLink]="['/agentes', al.agentId]" class="cockpit__id-link">
                        {{ al.agentId | slice:0:8 }}…
                      </a>
                    </td>
                    <td>{{ kindLabel(al.kind) }}</td>
                    <td>
                      <gov-badge [variant]="severityBadge(al.severity)" size="sm">
                        {{ severityLabel(al.severity) }}
                      </gov-badge>
                    </td>
                    <td class="cockpit__td--msg">{{ al.message }}</td>
                    <td class="cockpit__td--mono">
                      {{ al.createdAt | date: 'dd/MM/yy HH:mm' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

    </main>
  `,
  styles: [`
    .cockpit {
      padding: var(--gov-space-8);
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-8);
    }

    /* ── KPI grid ───────────────────────────────────────────── */
    .cockpit__kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--gov-space-4);
    }

    @media (max-width: 900px) {
      .cockpit__kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 520px) {
      .cockpit__kpi-grid { grid-template-columns: 1fr; }
    }

    .cockpit__kpi-skeleton {
      height: 110px;
      border-radius: var(--gov-radius-xl);
      background: linear-gradient(
        90deg,
        var(--gov-color-neutral-100) 25%,
        var(--gov-color-neutral-300) 50%,
        var(--gov-color-neutral-100) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }

    /* ── Seções ─────────────────────────────────────────────── */
    .cockpit__section {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-4);
    }

    .cockpit__section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .cockpit__section-title {
      font-size: var(--gov-font-size-lg);
      font-weight: var(--gov-font-weight-semibold);
      color: var(--gov-color-text-primary);
    }

    .cockpit__ver-mais {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-brand);
      font-weight: var(--gov-font-weight-medium);
      text-decoration: none;

      &:hover { text-decoration: underline; }
    }

    /* ── Tabela ─────────────────────────────────────────────── */
    .cockpit__table-wrap {
      overflow-x: auto;
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-lg);
    }

    .cockpit__table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--gov-font-size-sm);

      thead {
        background: var(--gov-color-neutral-50);

        th {
          padding: var(--gov-space-3) var(--gov-space-4);
          text-align: left;
          font-weight: var(--gov-font-weight-semibold);
          color: var(--gov-color-text-secondary);
          border-bottom: 1px solid var(--gov-color-border);
          white-space: nowrap;
        }
      }

      tbody tr {
        border-bottom: 1px solid var(--gov-color-border);
        transition: background var(--gov-transition-fast);

        &:last-child { border-bottom: none; }
        &:hover { background: var(--gov-color-primary-50); }
      }

      td {
        padding: var(--gov-space-3) var(--gov-space-4);
        color: var(--gov-color-text-primary);
        vertical-align: middle;
      }
    }

    .cockpit__td--mono {
      font-family: var(--gov-font-family-mono);
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
    }

    .cockpit__id-link {
      color: inherit;
      text-decoration: none;
      font-family: var(--gov-font-family-mono);

      &:hover { color: var(--gov-color-brand); text-decoration: underline; }
    }

    .cockpit__td--num {
      text-align: right;
      font-family: var(--gov-font-family-mono);
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
    }

    .cockpit__td--msg {
      max-width: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cockpit__table-skeleton {
      height: 160px;
      border-radius: var(--gov-radius-lg);
      background: linear-gradient(
        90deg,
        var(--gov-color-neutral-100) 25%,
        var(--gov-color-neutral-300) 50%,
        var(--gov-color-neutral-100) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Empty & error ──────────────────────────────────────── */
    .cockpit__empty {
      padding: var(--gov-space-8);
      text-align: center;
      color: var(--gov-color-text-secondary);
      font-size: var(--gov-font-size-sm);
      border: 1px dashed var(--gov-color-border);
      border-radius: var(--gov-radius-lg);
    }

    .cockpit__error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gov-space-4);
      padding: var(--gov-space-3) var(--gov-space-4);
      background: var(--gov-color-error-100);
      border: 1px solid var(--gov-color-error-500);
      border-radius: var(--gov-radius-md);
      color: var(--gov-color-error-700);
      font-size: var(--gov-font-size-sm);

      button {
        background: var(--gov-color-error-500);
        color: var(--gov-color-white);
        border: none;
        border-radius: var(--gov-radius-md);
        padding: var(--gov-space-1) var(--gov-space-3);
        font-size: var(--gov-font-size-sm);
        font-weight: var(--gov-font-weight-semibold);
        white-space: nowrap;
        transition: background var(--gov-transition-fast);

        &:hover { background: var(--gov-color-error-700); }
      }
    }

    /* ── Accessibility ──────────────────────────────────────── */
    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `],
})
export class DashboardComponent implements OnInit {
  private readonly svc = inject(DashboardService);

  protected readonly loading          = signal(true);
  protected readonly error            = signal<string | null>(null);

  protected readonly agentesAtivos    = signal(0);
  protected readonly alertasAbertos   = signal(0);
  protected readonly totalDecisoes    = signal(0);
  protected readonly totalBloqueados  = signal(0);

  protected readonly alertasTop5      = signal<Alert[]>([]);
  protected readonly eventosRecentes  = signal<AuditEvent[]>([]);

  protected readonly alertasSorted = computed(() =>
    [...this.alertasTop5()].sort(
      (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity],
    ),
  );

  readonly skeletons   = Array(4).fill(null);
  readonly iconAgentes = ICON_AGENTES;
  readonly iconAlertas = ICON_ALERTAS;
  readonly iconDecisoes  = ICON_DECISOES;
  readonly iconBloqueado = ICON_BLOQUEADO;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.svc.loadCockpit().subscribe({
      next: (data) => {
        this.agentesAtivos.set(
          data.agentes.data.filter((a) => a.status === 'ACTIVE').length,
        );
        this.alertasAbertos.set(data.alertas.total);
        this.alertasTop5.set(data.alertas.data);
        this.totalDecisoes.set(data.decisoes.total);
        this.eventosRecentes.set(data.decisoes.data);
        this.totalBloqueados.set(data.bloqueados.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          err?.error?.message ?? err?.message ?? 'Erro ao carregar cockpit.',
        );
        this.loading.set(false);
      },
    });
  }

  outcomeBadge(outcome: Outcome): BadgeVariant     { return OUTCOME_BADGE[outcome]; }
  outcomeLabel(outcome: Outcome): string           { return OUTCOME_LABELS[outcome]; }
  severityBadge(sev: AlertSeverity): BadgeVariant  { return SEVERITY_BADGE[sev]; }
  severityLabel(sev: AlertSeverity): string        { return SEVERITY_LABELS[sev]; }
  kindLabel(kind: Alert['kind']): string           { return KIND_LABELS[kind]; }
}
