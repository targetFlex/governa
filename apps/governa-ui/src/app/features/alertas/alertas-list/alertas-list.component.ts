// ============================================================
// alertas-list.component.ts
//
// Tela de alertas (/alertas) — E4.5.
//
// Responsabilidades (SRP):
//   - Carregar alertas via AlertasStore.loadAlertas() no ngOnInit
//   - Conectar ao feed SSE via AlertasStore.conectarStream()
//   - Renderizar filtros (kind, status, agentId, período)
//   - Renderizar feed de alertas com badges de severity/status
//   - Ações inline: Acknowledge / Resolve por alerta
//   - Painel de configuração de thresholds (expandível)
//   - Estados: loading / error / empty / lista
//
// Acessibilidade (WCAG 2.1 AA):
//   - role="status" no loading e empty state
//   - role="alert" no banner de erro
//   - aria-live="polite" na região do feed
//   - aria-label descritivo em cada botão de ação
//   - caption na <table> para leitores de tela
// ============================================================

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule }      from '@angular/common';
import { FormsModule }       from '@angular/forms';
import { AlertasStore }      from '../alertas.service';
import {
  ALERT_KINDS,
  ALERT_STATUSES,
  KIND_LABELS,
  SEVERITY_CSS,
  SEVERITY_LABELS,
  STATUS_CSS,
  STATUS_LABELS,
  AlertKind,
  AlertStatus,
  AlertThreshold,
} from '../../../shared/models/alertas.model';

@Component({
  selector: 'app-alertas-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="alertas" aria-label="Feed de alertas dos agentes">

      <!-- ── Cabeçalho ──────────────────────────────────────── -->
      <header class="alertas__header">
        <div class="alertas__header-texto">
          <h1 class="alertas__titulo">Alertas</h1>
          <p class="alertas__subtitulo">
            Feed em tempo real de violações, erros e anomalias dos agentes.
            <span
              class="alertas__sse-badge"
              [class.alertas__sse-badge--on]="store.streamConnected()"
              aria-label="Status da conexão em tempo real"
            >
              {{ store.streamConnected() ? '● Ao vivo' : '○ Desconectado' }}
            </span>
          </p>
        </div>
        <div class="alertas__header-acoes">
          <span class="alertas__open-count" *ngIf="store.openCount() > 0">
            {{ store.openCount() }} aberto{{ store.openCount() !== 1 ? 's' : '' }}
          </span>
          <button
            class="alertas__btn-config"
            type="button"
            [attr.aria-expanded]="mostrarConfig"
            aria-controls="painel-config"
            (click)="toggleConfig()"
          >
            {{ mostrarConfig ? 'Fechar configurações' : 'Configurar thresholds' }}
          </button>
        </div>
      </header>

      <!-- ── Painel de configuração de thresholds ───────────── -->
      <aside
        *ngIf="mostrarConfig"
        id="painel-config"
        class="alertas__config"
        aria-label="Configuração de thresholds"
      >
        <h2 class="alertas__config-titulo">Thresholds de alerta</h2>

        <div *ngIf="store.loadingThresh()" role="status" aria-label="Carregando thresholds">
          <div class="alertas__skeleton alertas__skeleton--row" *ngFor="let s of skeletons4"></div>
        </div>

        <div *ngIf="!store.loadingThresh()" class="alertas__config-grid">
          <div
            *ngFor="let t of store.thresholds()"
            class="alertas__config-card"
          >
            <div class="alertas__config-card-header">
              <span class="alertas__config-kind">{{ kindLabel(t.kind) }}</span>
              <label class="alertas__toggle" [attr.aria-label]="'Habilitar ' + kindLabel(t.kind)">
                <input
                  type="checkbox"
                  [checked]="t.enabled"
                  (change)="salvarEnabled(t, $event)"
                />
                <span class="alertas__toggle-label">{{ t.enabled ? 'Habilitado' : 'Desabilitado' }}</span>
              </label>
            </div>

            <div class="alertas__config-fields" *ngIf="t.kind === 'ERROR_RATE' && t.enabled">
              <label class="alertas__config-label">
                Taxa de erro máxima (%)
                <input
                  class="alertas__config-input"
                  type="number"
                  min="0"
                  max="100"
                  [value]="t.errorRatePercent ?? 10"
                  (change)="salvarErrorRate(t, $event)"
                  aria-describedby="desc-error-rate"
                />
                <small id="desc-error-rate">Alertar quando taxa de erro superar este valor.</small>
              </label>
            </div>

            <div class="alertas__config-fields" *ngIf="t.kind === 'VOLUME_ANOMALY' && t.enabled">
              <label class="alertas__config-label">
                Volume máximo por hora
                <input
                  class="alertas__config-input"
                  type="number"
                  min="1"
                  [value]="t.volumePerHour ?? 500"
                  (change)="salvarVolumePerHour(t, $event)"
                  aria-describedby="desc-volume"
                />
                <small id="desc-volume">Alertar quando decisões/hora superar este valor.</small>
              </label>
            </div>

            <div class="alertas__config-fields" *ngIf="t.kind === 'CHECKPOINT_EXPIRED' && t.enabled">
              <label class="alertas__config-label">
                Tempo de expiração (min)
                <input
                  class="alertas__config-input"
                  type="number"
                  min="5"
                  [value]="t.checkpointExpiryMin ?? 60"
                  (change)="salvarCheckpointExpiry(t, $event)"
                  aria-describedby="desc-checkpoint"
                />
                <small id="desc-checkpoint">Alertar quando checkpoint humano não for resolvido neste prazo.</small>
              </label>
            </div>
          </div>
        </div>
      </aside>

      <!-- ── Filtros ─────────────────────────────────────────── -->
      <form class="alertas__filtros" (ngSubmit)="aplicarFiltros()" role="search" aria-label="Filtrar alertas">

        <label class="alertas__filtro-label">
          Tipo
          <select class="alertas__filtro-select" [(ngModel)]="kindFiltro" name="kind">
            <option value="">Todos</option>
            <option *ngFor="let k of kinds" [value]="k">{{ kindLabel(k) }}</option>
          </select>
        </label>

        <label class="alertas__filtro-label">
          Status
          <select class="alertas__filtro-select" [(ngModel)]="statusFiltro" name="status">
            <option value="">Todos</option>
            <option *ngFor="let s of statuses" [value]="s">{{ statusLabel(s) }}</option>
          </select>
        </label>

        <label class="alertas__filtro-label">
          Agente (ID)
          <input
            class="alertas__filtro-input"
            type="text"
            [(ngModel)]="agentIdFiltro"
            name="agentId"
            placeholder="UUID do agente"
            autocomplete="off"
          />
        </label>

        <label class="alertas__filtro-label">
          De
          <input class="alertas__filtro-input" type="datetime-local" [(ngModel)]="fromFiltro" name="from" />
        </label>

        <label class="alertas__filtro-label">
          Até
          <input class="alertas__filtro-input" type="datetime-local" [(ngModel)]="toFiltro" name="to" />
        </label>

        <div class="alertas__filtro-acoes">
          <button class="alertas__btn alertas__btn-filtrar" type="submit" aria-label="Aplicar filtros">
            Filtrar
          </button>
          <button class="alertas__btn alertas__btn-limpar" type="button" (click)="limparFiltros()" aria-label="Limpar filtros">
            Limpar
          </button>
        </div>
      </form>

      <!-- ── Banner de erro ─────────────────────────────────── -->
      <div
        *ngIf="store.hasError()"
        class="alertas__erro"
        role="alert"
        aria-live="assertive"
      >
        <p class="alertas__erro-msg">{{ store.error() }}</p>
        <button class="alertas__btn alertas__btn-retry" type="button" (click)="retry()" aria-label="Tentar novamente">
          Tentar novamente
        </button>
      </div>

      <!-- ── Loading skeletons ──────────────────────────────── -->
      <div *ngIf="store.loading()" class="alertas__loading" role="status" aria-label="Carregando alertas">
        <div class="alertas__skeleton alertas__skeleton--header"></div>
        <div class="alertas__skeleton alertas__skeleton--row" *ngFor="let s of skeletons"></div>
      </div>

      <!-- ── Feed de alertas ────────────────────────────────── -->
      <div aria-live="polite" aria-label="Alertas">

        <!-- Empty state -->
        <div *ngIf="store.isEmpty() && !store.hasError()" class="alertas__empty" role="status">
          <p class="alertas__empty-msg">Nenhum alerta encontrado para os filtros selecionados.</p>
          <button class="alertas__btn alertas__btn-limpar" type="button" (click)="limparFiltros()">
            Limpar filtros
          </button>
        </div>

        <!-- Tabela -->
        <div
          *ngIf="!store.loading() && !store.isEmpty()"
          class="alertas__tabela-wrapper"
        >
          <table class="alertas__tabela" aria-label="Lista de alertas">
            <caption class="sr-only">
              {{ store.total() }} alerta{{ store.total() !== 1 ? 's' : '' }} encontrado{{ store.total() !== 1 ? 's' : '' }}.
            </caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Tipo</th>
                <th scope="col">Severidade</th>
                <th scope="col">Status</th>
                <th scope="col">Agente</th>
                <th scope="col">Mensagem</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let alerta of store.alertas()"
                class="alertas__row"
                [class.alertas__row--open]="alerta.status === 'OPEN'"
              >
                <td class="alertas__col-data">{{ formatDate(alerta.createdAt) }}</td>
                <td>
                  <span class="alertas__kind-label">{{ kindLabel(alerta.kind) }}</span>
                </td>
                <td>
                  <span class="alertas__badge" [class]="severityCss(alerta.severity)">
                    {{ severityLabel(alerta.severity) }}
                  </span>
                </td>
                <td>
                  <span class="alertas__status" [class]="statusCss(alerta.status)">
                    {{ statusLabel(alerta.status) }}
                  </span>
                </td>
                <td class="alertas__col-agente">{{ truncar(alerta.agentId, 8) }}…</td>
                <td class="alertas__col-msg">{{ truncar(alerta.message, 80) }}</td>
                <td class="alertas__col-acoes">
                  <button
                    *ngIf="alerta.status === 'OPEN'"
                    class="alertas__btn-acao alertas__btn-ack"
                    type="button"
                    [attr.aria-label]="'Reconhecer alerta ' + alerta.id"
                    [disabled]="store.loadingStatus()"
                    (click)="ack(alerta.id)"
                  >
                    Reconhecer
                  </button>
                  <button
                    *ngIf="alerta.status === 'ACKNOWLEDGED'"
                    class="alertas__btn-acao alertas__btn-resolve"
                    type="button"
                    [attr.aria-label]="'Resolver alerta ' + alerta.id"
                    [disabled]="store.loadingStatus()"
                    (click)="resolve(alerta.id)"
                  >
                    Resolver
                  </button>
                  <span *ngIf="alerta.status === 'RESOLVED'" class="alertas__resolved-label">
                    Resolvido
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginação -->
        <nav
          *ngIf="!store.loading() && store.totalPages() > 1"
          class="alertas__paginacao"
          aria-label="Navegação de páginas"
        >
          <button
            class="alertas__pag-btn"
            type="button"
            [disabled]="store.page() <= 1"
            aria-label="Página anterior"
            (click)="irParaPagina(store.page() - 1)"
          >
            ← Anterior
          </button>
          <span class="alertas__pag-info" aria-live="polite">
            Página {{ store.page() }} de {{ store.totalPages() }}
          </span>
          <button
            class="alertas__pag-btn"
            type="button"
            [disabled]="store.page() >= store.totalPages()"
            aria-label="Próxima página"
            (click)="irParaPagina(store.page() + 1)"
          >
            Próxima →
          </button>
        </nav>

      </div>
    </section>
  `,
  styles: [`
    .alertas {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px;
      font-family: var(--gov-font-family, 'Inter', sans-serif);
    }

    /* ── Cabeçalho ─────────────────────────────────────────── */
    .alertas__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      gap: 16px;
      flex-wrap: wrap;
    }

    .alertas__titulo {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--gov-color-primary, #1a3a5c);
      margin: 0 0 4px;
    }

    .alertas__subtitulo {
      font-size: 0.875rem;
      color: var(--gov-color-text-secondary, #6b7280);
      margin: 0;
    }

    .alertas__sse-badge {
      display: inline-block;
      margin-left: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--gov-color-text-secondary, #6b7280);
    }

    .alertas__sse-badge--on { color: #15803d; }

    .alertas__header-acoes {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .alertas__open-count {
      font-size: 0.8rem;
      font-weight: 700;
      background: #fee2e2;
      color: #b91c1c;
      padding: 4px 10px;
      border-radius: 12px;
    }

    /* ── Config thresholds ─────────────────────────────────── */
    .alertas__btn-config {
      padding: 8px 16px;
      border: 1px solid var(--gov-color-primary, #1a3a5c);
      border-radius: 4px;
      background: transparent;
      color: var(--gov-color-primary, #1a3a5c);
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
    }

    .alertas__config {
      background: var(--gov-color-surface, #f8fafc);
      border: 1px solid var(--gov-color-border, #e2e8f0);
      border-radius: var(--gov-radius, 6px);
      padding: 16px;
      margin-bottom: 24px;
    }

    .alertas__config-titulo {
      font-size: 1rem;
      font-weight: 700;
      color: var(--gov-color-primary, #1a3a5c);
      margin: 0 0 12px;
    }

    .alertas__config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }

    .alertas__config-card {
      background: #fff;
      border: 1px solid var(--gov-color-border, #e2e8f0);
      border-radius: 4px;
      padding: 12px;
    }

    .alertas__config-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .alertas__config-kind {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--gov-color-text-primary, #1a1a2e);
    }

    .alertas__toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }

    .alertas__toggle-label { font-size: 0.75rem; color: var(--gov-color-text-secondary, #6b7280); }

    .alertas__config-fields { margin-top: 8px; }

    .alertas__config-label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.8rem;
      color: var(--gov-color-text-primary, #1a1a2e);
    }

    .alertas__config-label small {
      font-size: 0.7rem;
      color: var(--gov-color-text-secondary, #6b7280);
    }

    .alertas__config-input {
      padding: 6px 8px;
      border: 1px solid var(--gov-color-border, #e2e8f0);
      border-radius: 4px;
      font-size: 0.875rem;
      width: 100%;
      box-sizing: border-box;
    }

    /* ── Filtros ───────────────────────────────────────────── */
    .alertas__filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
      background: var(--gov-color-surface, #f8fafc);
      padding: 16px;
      border-radius: var(--gov-radius, 6px);
      border: 1px solid var(--gov-color-border, #e2e8f0);
      margin-bottom: 16px;
    }

    .alertas__filtro-label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--gov-color-text-primary, #1a1a2e);
      min-width: 140px;
    }

    .alertas__filtro-select,
    .alertas__filtro-input {
      padding: 6px 8px;
      border: 1px solid var(--gov-color-border, #e2e8f0);
      border-radius: 4px;
      font-size: 0.875rem;
      background: #fff;
      color: var(--gov-color-text-primary, #1a1a2e);
    }

    .alertas__filtro-acoes {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      padding-bottom: 1px;
    }

    /* ── Botões ────────────────────────────────────────────── */
    .alertas__btn {
      padding: 7px 16px;
      border-radius: 4px;
      border: 1px solid var(--gov-color-primary, #1a3a5c);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
    }

    .alertas__btn-filtrar { background: var(--gov-color-primary, #1a3a5c); color: #fff; }
    .alertas__btn-limpar  { background: transparent; color: var(--gov-color-primary, #1a3a5c); }
    .alertas__btn-retry   { background: #b91c1c; color: #fff; border-color: #b91c1c; }

    /* ── Erro ──────────────────────────────────────────────── */
    .alertas__erro {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      border-radius: 4px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      gap: 12px;
    }

    .alertas__erro-msg {
      margin: 0;
      font-size: 0.875rem;
      color: #b91c1c;
    }

    /* ── Loading skeletons ─────────────────────────────────── */
    .alertas__loading { padding: 8px 0; }

    .alertas__skeleton {
      background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .alertas__skeleton--header { height: 40px; width: 100%; }
    .alertas__skeleton--row    { height: 52px; width: 100%; }

    @keyframes shimmer { to { background-position: -200% 0; } }

    /* ── Empty ─────────────────────────────────────────────── */
    .alertas__empty {
      text-align: center;
      padding: 48px 24px;
      color: var(--gov-color-text-secondary, #6b7280);
    }

    .alertas__empty-msg { margin-bottom: 16px; font-size: 0.9rem; }

    /* ── Tabela ────────────────────────────────────────────── */
    .alertas__tabela-wrapper {
      overflow-x: auto;
      border: 1px solid var(--gov-color-border, #e2e8f0);
      border-radius: var(--gov-radius, 6px);
      margin-bottom: 16px;
    }

    .alertas__tabela {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .alertas__tabela thead th {
      background: var(--gov-color-primary, #1a3a5c);
      color: #fff;
      padding: 10px 12px;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .alertas__row td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--gov-color-border, #e2e8f0);
      vertical-align: top;
      color: var(--gov-color-text-primary, #1a1a2e);
    }

    .alertas__row--open td { border-left: 3px solid #b91c1c; }
    .alertas__row:last-child td { border-bottom: none; }
    .alertas__row:nth-child(even) td { background: var(--gov-color-surface, #f8fafc); }

    .alertas__col-data   { white-space: nowrap; font-size: 0.8rem; color: var(--gov-color-text-secondary, #6b7280); }
    .alertas__col-agente { font-family: monospace; font-size: 0.8rem; }
    .alertas__col-msg    { max-width: 240px; word-break: break-word; }
    .alertas__col-acoes  { white-space: nowrap; }

    .alertas__kind-label { font-size: 0.8rem; font-weight: 600; }

    /* ── Badges de severidade ──────────────────────────────── */
    .alertas__badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .badge--low      { background: #f3f4f6; color: #374151; }
    .badge--medium   { background: #fef9c3; color: #92400e; }
    .badge--high     { background: #ffedd5; color: #9a3412; }
    .badge--critical { background: #fee2e2; color: #b91c1c; }

    /* ── Badges de status ──────────────────────────────────── */
    .alertas__status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status--open         { background: #fee2e2; color: #b91c1c; }
    .status--acknowledged { background: #fef9c3; color: #92400e; }
    .status--resolved     { background: #dcfce7; color: #15803d; }

    /* ── Botões de ação na tabela ──────────────────────────── */
    .alertas__btn-acao {
      padding: 4px 10px;
      border-radius: 4px;
      border: 1px solid;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
    }

    .alertas__btn-ack     { border-color: #92400e; color: #92400e; background: #fef9c3; }
    .alertas__btn-resolve { border-color: #15803d; color: #15803d; background: #dcfce7; }
    .alertas__btn-acao:disabled { opacity: 0.4; cursor: not-allowed; }

    .alertas__resolved-label { font-size: 0.75rem; color: #15803d; font-weight: 600; }

    /* ── Paginação ─────────────────────────────────────────── */
    .alertas__paginacao {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }

    .alertas__pag-btn {
      padding: 6px 14px;
      border: 1px solid var(--gov-color-primary, #1a3a5c);
      border-radius: 4px;
      background: transparent;
      color: var(--gov-color-primary, #1a3a5c);
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
    }

    .alertas__pag-btn:disabled { opacity: 0.35; cursor: not-allowed; }

    .alertas__pag-info {
      font-size: 0.85rem;
      color: var(--gov-color-text-secondary, #6b7280);
    }

    /* ── Utilitário ────────────────────────────────────────── */
    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border: 0;
    }
  `],
})
export class AlertasListComponent implements OnInit, OnDestroy {
  readonly store    = inject(AlertasStore);
  readonly kinds    = ALERT_KINDS;
  readonly statuses = ALERT_STATUSES;
  readonly skeletons  = Array(5).fill(0);
  readonly skeletons4 = Array(4).fill(0);

  mostrarConfig = false;

  // ── Campos de filtro ────────────────────────────────────────
  kindFiltro:    AlertKind | '' = '';
  statusFiltro:  AlertStatus | '' = '';
  agentIdFiltro = '';
  fromFiltro    = '';
  toFiltro      = '';

  ngOnInit(): void {
    this.store.loadAlertas();
    this.store.loadThresholds();
    this.store.conectarStream();
  }

  ngOnDestroy(): void {
    this.store.desconectarStream();
  }

  toggleConfig(): void {
    this.mostrarConfig = !this.mostrarConfig;
  }

  aplicarFiltros(): void {
    this.store.loadAlertas({
      kind:    this.kindFiltro,
      status:  this.statusFiltro,
      agentId: this.agentIdFiltro,
      from:    this.fromFiltro,
      to:      this.toFiltro,
      page:    1,
    });
  }

  limparFiltros(): void {
    this.kindFiltro    = '';
    this.statusFiltro  = '';
    this.agentIdFiltro = '';
    this.fromFiltro    = '';
    this.toFiltro      = '';
    this.store.limparFiltros();
  }

  retry(): void {
    this.store.clearError();
    this.store.loadAlertas();
  }

  irParaPagina(page: number): void {
    this.store.loadAlertas({ page });
  }

  ack(id: string): void {
    this.store.atualizarStatus(id, 'ACKNOWLEDGED');
  }

  resolve(id: string): void {
    this.store.atualizarStatus(id, 'RESOLVED');
  }

  // ── Salvar thresholds ───────────────────────────────────────

  salvarEnabled(t: AlertThreshold, event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.store.salvarThreshold(t.kind, { enabled });
  }

  salvarErrorRate(t: AlertThreshold, event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.store.salvarThreshold(t.kind, { errorRatePercent: val });
  }

  salvarVolumePerHour(t: AlertThreshold, event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.store.salvarThreshold(t.kind, { volumePerHour: val });
  }

  salvarCheckpointExpiry(t: AlertThreshold, event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.store.salvarThreshold(t.kind, { checkpointExpiryMin: val });
  }

  // ── Helpers ──────────────────────────────────────────────────

  kindLabel(k: AlertKind): string     { return KIND_LABELS[k] ?? k; }
  severityCss(s: string): string      { return SEVERITY_CSS[s as keyof typeof SEVERITY_CSS] ?? ''; }
  severityLabel(s: string): string    { return SEVERITY_LABELS[s as keyof typeof SEVERITY_LABELS] ?? s; }
  statusCss(s: string): string        { return STATUS_CSS[s as keyof typeof STATUS_CSS] ?? ''; }
  statusLabel(s: AlertStatus): string { return STATUS_LABELS[s] ?? s; }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  truncar(texto: string, max: number): string {
    return texto.length > max ? texto.slice(0, max) + '…' : texto;
  }
}
