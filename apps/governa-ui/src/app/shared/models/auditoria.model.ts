/**
 * auditoria.model.ts — Modelos de domínio para o audit trail no frontend.
 *
 * Espelha AuditEventEntity do governa-core (leitura only — imutável).
 */

export type Outcome =
  | 'EXECUTADO'
  | 'BLOQUEADO'
  | 'AGUARDANDO'
  | 'ESCALADO'
  | 'ERRO'

export const OUTCOMES: readonly Outcome[] = [
  'EXECUTADO',
  'BLOQUEADO',
  'AGUARDANDO',
  'ESCALADO',
  'ERRO',
] as const

export interface AuditEvent {
  readonly id:               string
  readonly tenantId:         string
  readonly agentId:          string
  readonly traceId:          string
  readonly spanId?:          string
  readonly action:           string
  readonly toolCalled?:      string
  readonly inputSummary:     string
  readonly outcome:          Outcome
  readonly latencyMs:        number
  readonly subjectToken:     string
  readonly dataCategories:   string[]
  readonly legalBasis:       string
  readonly purpose:          string
  readonly retentionUntil:   string  // ISO string
  readonly approverId?:      string
  readonly escalationReason?: string
  readonly createdAt:        string  // ISO string
}

export interface AuditEventPage {
  data:  AuditEvent[]
  total: number
  page:  number
  limit: number
}

export interface AuditFiltros {
  agentId:  string
  from:     string   // date input value (YYYY-MM-DD) ou ''
  to:       string
  outcome:  Outcome | ''
  page:     number
  limit:    number
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  EXECUTADO:  'Executado',
  BLOQUEADO:  'Bloqueado',
  AGUARDANDO: 'Aguardando',
  ESCALADO:   'Escalado',
  ERRO:       'Erro',
}

export const OUTCOME_CSS: Record<Outcome, string> = {
  EXECUTADO:  'badge--verde',
  BLOQUEADO:  'badge--vermelho',
  AGUARDANDO: 'badge--amarelo',
  ESCALADO:   'badge--laranja',
  ERRO:       'badge--cinza',
}
