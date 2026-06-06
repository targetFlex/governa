import { createHash } from 'node:crypto'

import { canonicalJson } from './canonical-json'

/**
 * GENESIS_PREV_HASH — usado como `prevHash` do primeiro evento de
 * cada cadeia (par tenantId/agentId). 64 zeros == hash SHA-256 vazio
 * "convencional" para indicar ausência de predecessor.
 */
export const GENESIS_PREV_HASH = '0'.repeat(64)

/**
 * Payload que entra no cálculo do hash. Tudo o que o adversário pode
 * tentar alterar para esconder evidência deve estar aqui.
 *
 * Conscientemente FORA: `id` e `createdAt`. O `id` é UUID gerado pelo
 * banco no INSERT (não disponível no momento do cálculo). O `createdAt`
 * é DEFAULT now() do banco, também pós-cálculo. Ambos são metadata de
 * persistência, não conteúdo de evidência.
 */
export interface HashablePayload {
  readonly tenantId:         string
  readonly agentId:          string
  readonly traceId:          string
  readonly spanId?:          string
  readonly prevHash:         string
  readonly action:           string
  readonly toolCalled?:      string
  readonly inputSummary:     string
  readonly outcome:          string
  readonly latencyMs:        number
  readonly subjectToken:     string
  readonly dataCategories:   readonly string[]
  readonly legalBasis:       string
  readonly purpose:          string
  readonly retentionUntil:   Date | string
  readonly approverId?:      string
  readonly escalationReason?: string
}

/**
 * computeHash — SHA-256 do payload serializado canonicamente.
 * Função pura. Mesmo input → mesmo output, para sempre.
 */
export function computeHash(payload: HashablePayload): string {
  const json = canonicalJson(payload)
  return createHash('sha256').update(json).digest('hex')
}
