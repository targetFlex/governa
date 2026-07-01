// ============================================================
// notification-config-panel.component.ts
//
// Painel de configuração de canais de notificação (email + webhook).
// Consumido pelo AlertasListComponent como painel expansível.
//
// Responsabilidades (SRP):
//   - Carregar config via NotificationConfigStore no ngOnInit
//   - Exibir formulário de email (toggle + lista de destinatários)
//   - Exibir formulário de webhook (toggle + URL + secret + minSeverity)
//   - Salvar via PUT /notifications/config ao clicar em Salvar
//   - Estado: loading / saving / erro / sucesso
//
// Acessibilidade (WCAG 2.1 AA):
//   - role="alert" no banner de erro
//   - aria-label descritivo em cada campo
//   - fieldset/legend para cada seção
// ============================================================

import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
  signal,
  effect,
} from '@angular/core'
import { CommonModule }      from '@angular/common'
import { FormsModule }       from '@angular/forms'
import { NotificationConfigStore } from '../notification-config.service'
import { GovInputComponent }   from '../../../shared/ui/input/gov-input.component'
import { GovSelectComponent, SelectOption } from '../../../shared/ui/select/gov-select.component'
import { GovButtonComponent }  from '../../../shared/ui/button/gov-button.component'
import {
  ALERT_SEVERITIES,
  SEVERITY_OPTION_LABELS,
  type NotificationConfigPatch,
  type AlertSeverity,
} from '../../../shared/models/notification-config.model'

@Component({
  selector: 'app-notification-config-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, GovInputComponent, GovSelectComponent, GovButtonComponent],
  template: `
    <aside class="notif-config" aria-label="Configuração de canais de notificação">
      <h2 class="notif-config__titulo">Canais de notificação</h2>
      <p class="notif-config__desc">
        Configure para onde os alertas são enviados quando disparados.
      </p>

      <!-- ── Erro ────────────────────────────────────────── -->
      <div
        *ngIf="store.hasError()"
        class="notif-config__erro"
        role="alert"
        aria-live="assertive"
      >
        <span>{{ store.error() }}</span>
        <button class="notif-config__erro-fechar" type="button" (click)="store.clearError()">✕</button>
      </div>

      <!-- ── Sucesso ──────────────────────────────────────── -->
      <div
        *ngIf="savedOk()"
        class="notif-config__sucesso"
        role="status"
        aria-live="polite"
      >
        Configuração salva com sucesso.
      </div>

      <!-- ── Loading ─────────────────────────────────────── -->
      <div *ngIf="store.loading()" class="notif-config__loading" role="status" aria-label="Carregando configuração">
        <div class="notif-config__skeleton" *ngFor="let s of skeletons"></div>
      </div>

      <!-- ── Formulário ──────────────────────────────────── -->
      <form
        *ngIf="!store.loading()"
        class="notif-config__form"
        (ngSubmit)="salvar()"
        aria-label="Formulário de notificações"
      >

        <!-- Email -->
        <fieldset class="notif-config__secao">
          <legend class="notif-config__secao-titulo">E-mail</legend>

          <label class="notif-config__toggle-label">
            <input
              type="checkbox"
              [(ngModel)]="emailEnabled"
              name="emailEnabled"
              aria-label="Habilitar notificações por e-mail"
            />
            Habilitar notificações por e-mail
          </label>

          <div *ngIf="emailEnabled" class="notif-config__secao-corpo">
            <div class="notif-config__destinatarios">
              <p class="notif-config__campo-label">Destinatários</p>
              <div
                *ngFor="let email of emailRecipients; let i = index"
                class="notif-config__destinatario-row"
              >
                <gov-input
                  [label]="'E-mail ' + (i + 1)"
                  type="email"
                  [(ngModel)]="emailRecipients[i]"
                  [name]="'email-' + i"
                  [attr.aria-label]="'Destinatário ' + (i + 1)"
                  autocomplete="email"
                />
                <button
                  type="button"
                  class="notif-config__btn-remover"
                  [attr.aria-label]="'Remover destinatário ' + (i + 1)"
                  (click)="removerDestinatario(i)"
                >✕</button>
              </div>
              <button
                type="button"
                class="notif-config__btn-adicionar"
                aria-label="Adicionar destinatário"
                (click)="adicionarDestinatario()"
              >
                + Adicionar e-mail
              </button>
            </div>
          </div>
        </fieldset>

        <!-- Webhook -->
        <fieldset class="notif-config__secao">
          <legend class="notif-config__secao-titulo">Webhook</legend>

          <label class="notif-config__toggle-label">
            <input
              type="checkbox"
              [(ngModel)]="webhookEnabled"
              name="webhookEnabled"
              aria-label="Habilitar notificações por webhook"
            />
            Habilitar notificações por webhook
          </label>

          <div *ngIf="webhookEnabled" class="notif-config__secao-corpo">
            <gov-input
              label="URL do webhook"
              type="url"
              [(ngModel)]="webhookUrl"
              name="webhookUrl"
              placeholder="https://hooks.exemplo.com/alerta"
              autocomplete="off"
            />
            <gov-input
              label="Secret (opcional, mín. 16 chars)"
              type="password"
              [(ngModel)]="webhookSecret"
              name="webhookSecret"
              placeholder="Deixe em branco para manter o atual"
              autocomplete="new-password"
            />
            <small class="notif-config__hint">
              O secret é usado para assinar o payload (header X-Governa-Signature).
              Deixe em branco para manter o valor atual.
            </small>
          </div>
        </fieldset>

        <!-- Severidade mínima -->
        <fieldset class="notif-config__secao">
          <legend class="notif-config__secao-titulo">Severidade mínima</legend>
          <gov-select
            label="Notificar a partir de"
            [(ngModel)]="minSeverity"
            name="minSeverity"
            [options]="severityOptions"
          />
        </fieldset>

        <!-- Ações -->
        <div class="notif-config__acoes">
          <gov-button
            type="submit"
            [loading]="store.saving()"
            ariaLabel="Salvar configuração de notificações"
          >
            {{ store.saving() ? 'Salvando…' : 'Salvar configuração' }}
          </gov-button>
        </div>

      </form>
    </aside>
  `,
  styles: [`
    .notif-config {
      background: var(--gov-color-surface, #f8fafc);
      border: 1px solid var(--gov-color-border, #e2e8f0);
      border-radius: var(--gov-radius, 6px);
      padding: 16px;
      margin-bottom: 24px;
    }

    .notif-config__titulo {
      font-size: 1rem;
      font-weight: 700;
      color: var(--gov-color-primary, #1a3a5c);
      margin: 0 0 4px;
    }

    .notif-config__desc {
      font-size: 0.8rem;
      color: var(--gov-color-text-secondary, #6b7280);
      margin: 0 0 16px;
    }

    /* ── Erro / Sucesso ──────────────────────────────────── */
    .notif-config__erro {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fee2e2;
      border: 1px solid #fca5a5;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 0.875rem;
      color: #b91c1c;
    }

    .notif-config__erro-fechar {
      background: none;
      border: none;
      cursor: pointer;
      color: #b91c1c;
      font-size: 1rem;
      line-height: 1;
      padding: 0 4px;
    }

    .notif-config__sucesso {
      background: #dcfce7;
      border: 1px solid #86efac;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 0.875rem;
      color: #15803d;
    }

    /* ── Loading ─────────────────────────────────────────── */
    .notif-config__loading { padding: 8px 0; }

    .notif-config__skeleton {
      height: 40px;
      background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 4px;
      margin-bottom: 8px;
    }

    @keyframes shimmer { to { background-position: -200% 0; } }

    /* ── Form ────────────────────────────────────────────── */
    .notif-config__form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .notif-config__secao {
      border: 1px solid var(--gov-color-border, #e2e8f0);
      border-radius: 4px;
      padding: 12px;
      margin: 0;
      background: #fff;
    }

    .notif-config__secao-titulo {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--gov-color-text-primary, #1a1a2e);
      padding: 0 4px;
    }

    .notif-config__toggle-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      color: var(--gov-color-text-primary, #1a1a2e);
      cursor: pointer;
      margin-bottom: 4px;
    }

    .notif-config__secao-corpo {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* ── Destinatários ───────────────────────────────────── */
    .notif-config__campo-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--gov-color-text-secondary, #6b7280);
      margin: 0 0 4px;
    }

    .notif-config__destinatarios {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .notif-config__destinatario-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }

    .notif-config__destinatario-row gov-input {
      flex: 1;
    }

    .notif-config__btn-remover {
      padding: 8px 10px;
      border: 1px solid #fca5a5;
      border-radius: 4px;
      background: #fee2e2;
      color: #b91c1c;
      font-size: 0.8rem;
      cursor: pointer;
      white-space: nowrap;
      align-self: flex-end;
      margin-bottom: 1px;
    }

    .notif-config__btn-remover:hover { background: #fecaca; }

    .notif-config__btn-adicionar {
      align-self: flex-start;
      padding: 6px 12px;
      border: 1px dashed var(--gov-color-primary, #1a3a5c);
      border-radius: 4px;
      background: transparent;
      color: var(--gov-color-primary, #1a3a5c);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 4px;
    }

    .notif-config__btn-adicionar:hover {
      background: rgba(26, 58, 92, 0.05);
    }

    /* ── Hint ────────────────────────────────────────────── */
    .notif-config__hint {
      font-size: 0.75rem;
      color: var(--gov-color-text-secondary, #6b7280);
      margin-top: 2px;
    }

    /* ── Ações ───────────────────────────────────────────── */
    .notif-config__acoes {
      display: flex;
      justify-content: flex-end;
    }
  `],
})
export class NotificationConfigPanelComponent implements OnInit {
  readonly store = inject(NotificationConfigStore)

  readonly severityOptions: SelectOption[] = ALERT_SEVERITIES.map(s => ({
    value: s,
    label: SEVERITY_OPTION_LABELS[s],
  }))

  readonly skeletons = Array(3).fill(0)

  // ── Estado local do formulário ────────────────────────────
  emailEnabled    = false
  emailRecipients: string[] = []
  webhookEnabled  = false
  webhookUrl      = ''
  webhookSecret   = ''
  minSeverity     = 'MEDIUM'

  readonly savedOk = signal(false)

  constructor() {
    // sincroniza o formulário toda vez que config mudar no store
    effect(() => {
      const cfg = this.store.config()
      if (cfg) this.syncFromStore()
    })

    // mostra feedback de sucesso quando saving transiciona false→false sem erro
    let wasSaving = false
    effect(() => {
      const saving   = this.store.saving()
      const hasError = this.store.hasError()
      if (wasSaving && !saving && !hasError) {
        this.savedOk.set(true)
        setTimeout(() => this.savedOk.set(false), 3000)
      }
      wasSaving = saving
    })
  }

  ngOnInit(): void {
    this.store.loadConfig()
  }

  private syncFromStore(): void {
    const cfg = this.store.config()
    if (!cfg) return
    this.emailEnabled    = cfg.emailEnabled
    this.emailRecipients = [...cfg.emailRecipients]
    this.webhookEnabled  = cfg.webhookEnabled
    this.webhookUrl      = cfg.webhookUrl ?? ''
    this.webhookSecret   = ''  // nunca pré-popula o secret
    this.minSeverity     = cfg.minSeverity
  }

  adicionarDestinatario(): void {
    this.emailRecipients = [...this.emailRecipients, '']
  }

  removerDestinatario(index: number): void {
    this.emailRecipients = this.emailRecipients.filter((_, i) => i !== index)
  }

  salvar(): void {
    this.savedOk.set(false)

    const patch: NotificationConfigPatch = {
      emailEnabled:    this.emailEnabled,
      emailRecipients: this.emailRecipients.filter(e => e.trim() !== ''),
      webhookEnabled:  this.webhookEnabled,
      webhookUrl:      this.webhookUrl.trim() || null,
      minSeverity:     this.minSeverity as AlertSeverity,
    }

    if (this.webhookSecret.trim()) {
      patch.webhookSecret = this.webhookSecret.trim()
    }

    this.store.saveConfig(patch)
  }
}
