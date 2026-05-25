import type { Outcome } from './outcome'

/**
 * AuditEventEntity — visão de domínio do evento de auditoria persistido.
 * Desacoplada do modelo Prisma para que AuditService/Verifier não
 * importem @prisma/client.
 *
 * Imutável por construção (readonly em todos os campos) — eventos
 * jamais devem ser mutados depois de criados. A imutabilidade é
 * sustentada também por GRANT de banco (role governa_app: append-only).
 */
export interface AuditEventEntity {
  readonly id:               string
  readonly tenantId:         string
  readonly agentId:          string
  readonly traceId:          string
  readonly spanId?:          string
  readonly prevHash:         string
  readonly hash:             string
  readonly action:           string
  readonly toolCalled?:      string
  readonly inputSummary:     string
  readonly outcome:          Outcome
  readonly latencyMs:        number
  readonly subjectToken:     string
  readonly dataCategories:   readonly string[]
  readonly legalBasis:       string
  readonly purpose:          string
  readonly retentionUntil:   Date
  readonly approverId?:      string
  readonly approvedAt?:      Date
  readonly escalationReason?: string
  readonly createdAt:        Date
}
