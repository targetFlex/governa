import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, tap, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { Agente, AgentStatus } from '../../../shared/models/agente.model';

type StatusMeta = { label: string; bg: string; color: string };

const STATUS_META: Record<AgentStatus, StatusMeta> = {
  ACTIVE:     { label: 'Ativo',      bg: '#dcfce7', color: '#166534' },
  PAUSED:     { label: 'Pausado',    bg: '#fef9c3', color: '#854d0e' },
  SANDBOX:    { label: 'Sandbox',    bg: '#dbeafe', color: '#1e40af' },
  DEPRECATED: { label: 'Depreciado', bg: '#f3f4f6', color: '#374151' },
};

@Component({
  selector: 'app-agente-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, RouterLink],
  template: `
    <div class="agente-detail">

      <!-- ── Navegação ───────────────────────────────────────── -->
      <nav class="agente-detail__nav" aria-label="Navegação de volta">
        <a routerLink="/agentes" class="agente-detail__back">
          ← Agentes
        </a>
      </nav>

      <!-- ── Erro ─────────────────────────────────────────────── -->
      @if (error()) {
        <div class="agente-detail__error" role="alert">
          <span>{{ error() }}</span>
          <button type="button" class="agente-detail__retry" (click)="load()">
            Tentar novamente
          </button>
        </div>
      }

      <!-- ── Não encontrado ────────────────────────────────────── -->
      @if (notFound()) {
        <div class="agente-detail__not-found" role="status">
          <p>Agente não encontrado.</p>
          <a routerLink="/agentes" class="agente-detail__back-link">
            Voltar para a lista
          </a>
        </div>
      }

      <!-- ── Loading ──────────────────────────────────────────── -->
      @if (loading()) {
        <div class="agente-detail__loading" role="status" aria-live="polite">
          <div class="agente-detail__skeleton agente-detail__skeleton--header" aria-hidden="true"></div>
          <div class="agente-detail__skeleton agente-detail__skeleton--body"   aria-hidden="true"></div>
          <span class="sr-only">Carregando agente…</span>
        </div>
      }

      <!-- ── Conteúdo ──────────────────────────────────────────── -->
      @if (!loading() && agente()) {
        <!-- Cabeçalho do agente -->
        <header class="agente-detail__header">
          <div class="agente-detail__titulo-wrap">
            <h1 class="agente-detail__nome">{{ agente()!.name }}</h1>
            @if (agente()!.description) {
              <p class="agente-detail__descricao">{{ agente()!.description }}</p>
            }
          </div>

          <div class="agente-detail__header-meta">
            <span
              class="agente-detail__status"
              [style.background]="statusMeta().bg"
              [style.color]="statusMeta().color"
              [attr.aria-label]="'Status: ' + statusMeta().label"
              role="status"
            >
              {{ statusMeta().label }}
            </span>

            @if (agente()!.status !== 'DEPRECATED') {
              <div class="agente-detail__acoes">

                @if (agente()!.status === 'ACTIVE') {
                  <button
                    class="agente-detail__btn agente-detail__btn--pausar"
                    type="button"
                    [disabled]="acaoEmAndamento()"
                    [attr.aria-busy]="acaoEmAndamento()"
                    [attr.aria-label]="acaoEmAndamento() ? 'Pausando agente' : 'Pausar agente'"
                    (click)="onPausar()"
                  >
                    @if (acaoEmAndamento()) {
                      <span class="agente-detail__spinner" aria-hidden="true"></span>
                      Pausando…
                    } @else {
                      Pausar
                    }
                  </button>
                }

                @if (agente()!.status === 'PAUSED' || agente()!.status === 'SANDBOX') {
                  <button
                    class="agente-detail__btn agente-detail__btn--ativar"
                    type="button"
                    [disabled]="acaoEmAndamento() || !agente()!.policyId"
                    [attr.aria-busy]="acaoEmAndamento()"
                    [attr.aria-label]="acaoEmAndamento()
                      ? 'Ativando agente'
                      : !agente()!.policyId
                        ? 'Ativar agente (requer política configurada)'
                        : 'Ativar agente'"
                    [title]="!agente()!.policyId ? 'Configure uma política antes de ativar' : ''"
                    (click)="onAtivar()"
                  >
                    @if (acaoEmAndamento()) {
                      <span class="agente-detail__spinner" aria-hidden="true"></span>
                      Ativando…
                    } @else {
                      Ativar
                    }
                  </button>
                }

              </div>
            }
          </div>
        </header>

        <!-- Grid de detalhes + ferramentas -->
        <div class="agente-detail__grid">

          <!-- Informações básicas -->
          <section class="agente-detail__card" aria-labelledby="sec-info">
            <h2 id="sec-info" class="agente-detail__card-title">Informações</h2>
            <dl class="agente-detail__dl">
              <div class="agente-detail__dl-row">
                <dt>Modelo</dt>
                <dd class="agente-detail__mono">{{ agente()!.modelId }}</dd>
              </div>
              <div class="agente-detail__dl-row">
                <dt>Política</dt>
                <dd>
                  @if (agente()!.policyId) {
                    <a [routerLink]="['/politicas', agente()!.policyId]"
                       class="agente-detail__policy-link">
                      Configurada
                    </a>
                  } @else {
                    <span class="agente-detail__no-policy">Sem política</span>
                  }
                </dd>
              </div>
              <div class="agente-detail__dl-row">
                <dt>Criado em</dt>
                <dd class="agente-detail__mono">{{ agente()!.createdAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
              </div>
              <div class="agente-detail__dl-row">
                <dt>Atualizado</dt>
                <dd class="agente-detail__mono">{{ agente()!.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
              </div>
              @if (agente()!.lastActiveAt) {
                <div class="agente-detail__dl-row">
                  <dt>Último ativo</dt>
                  <dd class="agente-detail__mono">{{ agente()!.lastActiveAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
                </div>
              }
            </dl>
          </section>

          <!-- Ferramentas -->
          <section class="agente-detail__card" aria-labelledby="sec-tools">
            <h2 id="sec-tools" class="agente-detail__card-title">
              Ferramentas
              <span
                class="agente-detail__tools-count"
                [attr.aria-label]="agente()!.tools.length + ' ferramenta(s)'"
              >
                {{ agente()!.tools.length }}
              </span>
            </h2>

            @if (agente()!.tools.length === 0) {
              <p class="agente-detail__tools-empty">Nenhuma ferramenta configurada.</p>
            } @else {
              <ul class="agente-detail__tools" aria-label="Ferramentas configuradas">
                @for (tool of agente()!.tools; track tool) {
                  <li class="agente-detail__tool-tag">{{ tool }}</li>
                }
              </ul>
            }
          </section>

        </div>
      }

    </div>
  `,
  styles: [`
    .agente-detail {
      padding: var(--gov-space-6) var(--gov-space-4);
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-6);
    }

    /* ── Navegação ── */
    .agente-detail__nav { margin-bottom: var(--gov-space-2); }

    .agente-detail__back {
      display: inline-flex;
      align-items: center;
      gap: var(--gov-space-1);
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-brand);
      font-weight: var(--gov-font-weight-medium);
      text-decoration: none;

      &:hover { text-decoration: underline; }
      &:focus-visible {
        outline: 3px solid var(--gov-color-brand);
        outline-offset: 2px;
        border-radius: 2px;
      }
    }

    /* ── Cabeçalho ── */
    .agente-detail__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--gov-space-4);
      flex-wrap: wrap;
      padding: var(--gov-space-6);
      background: var(--gov-color-surface);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-xl);
    }

    .agente-detail__titulo-wrap {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-2);
      flex: 1;
      min-width: 0;
    }

    .agente-detail__nome {
      font-size: var(--gov-font-size-2xl);
      font-weight: var(--gov-font-weight-bold);
      color: var(--gov-color-text-primary);
      margin: 0;
      word-break: break-word;
    }

    .agente-detail__descricao {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
      margin: 0;
      line-height: var(--gov-line-height-relaxed);
    }

    .agente-detail__header-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--gov-space-3);
      flex-shrink: 0;
    }

    .agente-detail__status {
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-semibold);
      padding: var(--gov-space-1) var(--gov-space-3);
      border-radius: var(--gov-radius-full);
      white-space: nowrap;
    }

    .agente-detail__acoes {
      display: flex;
      gap: var(--gov-space-2);
    }

    .agente-detail__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--gov-space-2);
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-semibold);
      padding: var(--gov-space-2) var(--gov-space-5);
      border-radius: var(--gov-radius-md);
      border: none;
      cursor: pointer;
      transition: background var(--gov-transition-fast);

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      &:focus-visible {
        outline: 3px solid currentColor;
        outline-offset: 2px;
      }
    }

    .agente-detail__btn--pausar {
      background: var(--gov-color-warning-100);
      color: var(--gov-color-warning-700);

      &:not(:disabled):hover {
        background: var(--gov-color-warning-500);
        color: var(--gov-color-white);
      }
    }

    .agente-detail__btn--ativar {
      background: var(--gov-color-success-100);
      color: var(--gov-color-success-700);

      &:not(:disabled):hover {
        background: var(--gov-color-success-500);
        color: var(--gov-color-white);
      }
    }

    /* ── Grid ── */
    .agente-detail__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--gov-space-4);
    }

    @media (max-width: 640px) {
      .agente-detail__grid { grid-template-columns: 1fr; }
    }

    /* ── Cards de seção ── */
    .agente-detail__card {
      background: var(--gov-color-surface);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-xl);
      padding: var(--gov-space-5);
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-4);
    }

    .agente-detail__card-title {
      display: flex;
      align-items: center;
      gap: var(--gov-space-2);
      font-size: var(--gov-font-size-base);
      font-weight: var(--gov-font-weight-semibold);
      color: var(--gov-color-text-primary);
      margin: 0;
    }

    /* ── DL de informações ── */
    .agente-detail__dl {
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }

    .agente-detail__dl-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--gov-space-3);
      padding: var(--gov-space-2) 0;
      border-bottom: 1px solid var(--gov-color-neutral-100);

      &:last-child { border-bottom: none; }

      dt {
        font-size: var(--gov-font-size-xs);
        color: var(--gov-color-text-secondary);
        white-space: nowrap;
      }

      dd {
        font-size: var(--gov-font-size-sm);
        color: var(--gov-color-text-primary);
        margin: 0;
        text-align: right;
        word-break: break-word;
      }
    }

    .agente-detail__mono {
      font-family: var(--gov-font-family-mono);
      font-size: var(--gov-font-size-xs) !important;
      color: var(--gov-color-text-secondary) !important;
    }

    .agente-detail__policy-link {
      color: var(--gov-color-brand);
      text-decoration: none;
      font-size: var(--gov-font-size-sm);

      &:hover { text-decoration: underline; }
    }

    .agente-detail__no-policy {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
      font-style: italic;
    }

    /* ── Ferramentas ── */
    .agente-detail__tools-count {
      font-size: var(--gov-font-size-xs);
      background: var(--gov-color-neutral-100);
      border-radius: var(--gov-radius-full);
      padding: 1px 8px;
      font-weight: var(--gov-font-weight-semibold);
      color: var(--gov-color-text-secondary);
    }

    .agente-detail__tools {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: var(--gov-space-2);
    }

    .agente-detail__tool-tag {
      font-size: var(--gov-font-size-xs);
      font-family: var(--gov-font-family-mono);
      background: var(--gov-color-primary-100);
      color: var(--gov-color-primary-700);
      border-radius: var(--gov-radius-md);
      padding: var(--gov-space-1) var(--gov-space-2);
      font-weight: var(--gov-font-weight-medium);
    }

    .agente-detail__tools-empty {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
      font-style: italic;
      margin: 0;
    }

    /* ── Loading ── */
    .agente-detail__loading {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-4);
    }

    .agente-detail__skeleton {
      border-radius: var(--gov-radius-xl);
      background: linear-gradient(
        90deg,
        var(--gov-color-neutral-100) 25%,
        var(--gov-color-neutral-300) 50%,
        var(--gov-color-neutral-100) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s ease infinite;
    }

    .agente-detail__skeleton--header { height: 140px; }
    .agente-detail__skeleton--body   { height: 200px; }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Erro ── */
    .agente-detail__error {
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
    }

    .agente-detail__retry {
      background: var(--gov-color-error-500);
      color: var(--gov-color-white);
      border: none;
      border-radius: var(--gov-radius-md);
      padding: var(--gov-space-1) var(--gov-space-3);
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-semibold);
      white-space: nowrap;
      cursor: pointer;
      transition: background var(--gov-transition-fast);

      &:hover { background: var(--gov-color-error-700); }
    }

    /* ── Não encontrado ── */
    .agente-detail__not-found {
      text-align: center;
      padding: var(--gov-space-12) 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--gov-space-4);

      p {
        font-size: var(--gov-font-size-base);
        color: var(--gov-color-text-secondary);
        margin: 0;
      }
    }

    .agente-detail__back-link {
      color: var(--gov-color-brand);
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      text-decoration: none;

      &:hover { text-decoration: underline; }
    }

    /* ── Spinner ── */
    .agente-detail__spinner {
      width: 12px;
      height: 12px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Accessibility ── */
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
export class AgenteDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http  = inject(HttpClient);

  protected readonly loading         = signal(true);
  protected readonly error           = signal<string | null>(null);
  protected readonly notFound        = signal(false);
  protected readonly agente          = signal<Agente | null>(null);
  protected readonly acaoEmAndamento = signal(false);

  protected readonly statusMeta = computed<StatusMeta>(() => {
    const ag = this.agente();
    return ag ? STATUS_META[ag.status] : STATUS_META['SANDBOX'];
  });

  private get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);

    this.http
      .get<{ data: Agente }>(`${environment.coreBaseUrl}/agents/${this.id}`)
      .pipe(
        tap((res) => this.agente.set(res.data)),
        catchError((err) => {
          if (err.status === 404) {
            this.notFound.set(true);
          } else {
            this.error.set(err?.error?.message ?? 'Erro ao carregar agente.');
          }
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  onPausar(): void {
    this.acaoEmAndamento.set(true);
    this.http
      .post<{ data: Agente }>(`${environment.coreBaseUrl}/agents/${this.id}/pause`, {})
      .pipe(
        tap((res) => this.agente.set(res.data)),
        catchError((err) => {
          this.error.set(err?.error?.message ?? /* istanbul ignore next */ 'Erro ao pausar agente.');
          return throwError(() => err);
        }),
        finalize(() => this.acaoEmAndamento.set(false)),
      )
      .subscribe();
  }

  onAtivar(): void {
    this.acaoEmAndamento.set(true);
    this.http
      .post<{ data: Agente }>(`${environment.coreBaseUrl}/agents/${this.id}/activate`, {})
      .pipe(
        tap((res) => this.agente.set(res.data)),
        catchError((err) => {
          this.error.set(err?.error?.message ?? /* istanbul ignore next */ 'Erro ao ativar agente.');
          return throwError(() => err);
        }),
        finalize(() => this.acaoEmAndamento.set(false)),
      )
      .subscribe();
  }
}
