import type { AuditEventEntity } from '../domain/audit-event.entity'
import type { AuditEventRepository } from '../domain/audit-event-repository.port'

import { GENESIS_PREV_HASH, computeHash } from './hash-chain'

const DEFAULT_BATCH_SIZE = 100

export interface VerifyResult {
  /** true se todos os eventos têm hash correto E prevHash bate com o anterior */
  readonly valid:       boolean
  /** índice 0-based do primeiro evento corrompido (undefined se valid) */
  readonly brokenAt?:   number
  /** quantos eventos foram verificados no total */
  readonly totalEvents: number
  /** razão da quebra — útil para diagnóstico */
  readonly reason?:     string
}

/**
 * AuditVerifier — valida integridade da cadeia de hashes para
 * (tenantId, agentId). Não muta nada, só lê via porta.
 *
 * Algoritmo:
 *   - itera eventos em ordem cronológica (createdAt asc)
 *   - para cada evento N:
 *       a) recalcula hash dos campos hasháveis e compara com o gravado
 *       b) verifica que prevHash == hash do evento N-1
 *          (ou GENESIS_PREV_HASH se N == 0)
 *   - na primeira divergência, retorna { valid: false, brokenAt: N }
 *
 * Streaming-friendly via AsyncIterable do repositório — não carrega
 * todos os eventos em memória, útil para cadeias longas.
 */
export class AuditVerifier {
  constructor(
    private readonly repo:      AuditEventRepository,
    private readonly batchSize: number = DEFAULT_BATCH_SIZE,
  ) {}

  async verify(tenantId: string, agentId: string): Promise<VerifyResult> {
    let prevHash    = GENESIS_PREV_HASH
    let index       = 0
    let totalEvents = 0

    for await (const event of this.repo.iterateChain(tenantId, agentId, this.batchSize)) {
      totalEvents = index + 1

      if (event.prevHash !== prevHash) {
        return {
          valid:       false,
          brokenAt:    index,
          totalEvents,
          reason:      `prevHash mismatch (expected ${prevHash.slice(0, 12)}…, got ${event.prevHash.slice(0, 12)}…)`,
        }
      }

      const recomputed = this.recompute(event)
      if (recomputed !== event.hash) {
        return {
          valid:       false,
          brokenAt:    index,
          totalEvents,
          reason:      `hash mismatch (event tampered)`,
        }
      }

      prevHash = event.hash
      index += 1
    }

    return { valid: true, totalEvents }
  }

  private recompute(e: AuditEventEntity): string {
    return computeHash({
      tenantId:         e.tenantId,
      agentId:          e.agentId,
      traceId:          e.traceId,
      spanId:           e.spanId,
      prevHash:         e.prevHash,
      action:           e.action,
      toolCalled:       e.toolCalled,
      inputSummary:     e.inputSummary,
      outcome:          e.outcome,
      latencyMs:        e.latencyMs,
      subjectToken:     e.subjectToken,
      dataCategories:   e.dataCategories,
      legalBasis:       e.legalBasis,
      purpose:          e.purpose,
      retentionUntil:   e.retentionUntil,
      approverId:       e.approverId,
      escalationReason: e.escalationReason,
    })
  }
}
