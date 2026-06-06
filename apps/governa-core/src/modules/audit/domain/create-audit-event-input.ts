import type { Outcome } from './outcome'

/**
 * Input de gravação de evento de auditoria.
 *
 * Convenções importantes (sustentadas por testes):
 *   - `inputSummary`    NUNCA contém PII (CPF/CNPJ/email/telefone/cartão).
 *                       O PiiDetector valida e rejeita antes de gravar.
 *   - `subjectToken`    Já é o HMAC do identificador do titular —
 *                       quem hashea é o caller via SubjectTokenHasher,
 *                       nunca o AuditService.
 *   - `dataCategories`  Categorias LGPD (ex: ['identificacao','financeiro']).
 *   - `legalBasis`      Base legal da LGPD (ex: 'execucao_contrato').
 *   - `purpose`         Finalidade declarada do tratamento.
 *
 * Campos calculados pelo service (não vêm do caller):
 *   - `id`, `traceId`, `prevHash`, `hash`, `retentionUntil`, `createdAt`
 */
export interface CreateAuditEventInput {
  readonly tenantId:         string
  readonly agentId:          string
  readonly action:           string
  readonly toolCalled?:      string
  readonly inputSummary:     string
  readonly outcome:          Outcome
  readonly latencyMs:        number
  readonly subjectToken:     string
  readonly dataCategories:   readonly string[]
  readonly legalBasis:       string
  readonly purpose:          string
  readonly approverId?:      string
  readonly escalationReason?: string
  /**
   * spanId opcional — propagado de tracing distribuído (preferência #1).
   * O traceId é sempre gerado pelo service (UUID v4).
   */
  readonly spanId?:          string
}
