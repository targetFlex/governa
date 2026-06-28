import { v4 as uuidv4 } from 'uuid'

import type { AuditEventEntity }                        from '../../src/modules/audit/domain/audit-event.entity'
import type {
  AuditEventInsert,
  AuditEventFilter,
  AuditEventPage,
  AuditEventRepository,
} from '../../src/modules/audit/domain/audit-event-repository.port'
import type { Outcome } from '../../src/modules/audit/domain/outcome'

import { GENESIS_PREV_HASH } from '../../src/modules/audit/application/hash-chain'

/**
 * InMemoryAuditEventRepository — adapter de teste para AuditEventRepository.
 *
 * Replica os invariantes obrigatórios da porta:
 *   - filtra SEMPRE por tenantId em toda leitura
 *   - appendInChain serializa (lock simulado via async queue) —
 *     em testes single-threaded o lock é trivial, mas a semântica é preservada
 *   - iterateChain entrega eventos em ordem createdAt asc, id asc
 *   - lastHashFor retorna null quando nenhum evento existe para o par
 *
 * Não depende de Prisma nem de banco — totalmente in-process.
 */
export class InMemoryAuditEventRepository implements AuditEventRepository {
  private readonly store: AuditEventEntity[] = []

  /** Utilitário de teste: insere evento já montado (bypassa chain logic) */
  seed(event: AuditEventEntity): void {
    this.store.push(event)
  }

  /** Utilitário de teste: limpa todo o estado */
  clear(): void {
    this.store.length = 0
  }

  /** Utilitário de teste: retorna cópia de todos os eventos gravados */
  all(): readonly AuditEventEntity[] {
    return [...this.store]
  }

  // ---------------------------------------------------------------------------
  // lastHashFor
  // ---------------------------------------------------------------------------

  async lastHashFor(tenantId: string, agentId: string): Promise<string | null> {
    const events = this.eventsFor(tenantId, agentId)
    if (events.length === 0) return null
    return events[events.length - 1].hash
  }

  // ---------------------------------------------------------------------------
  // appendInChain — simula lock de serialização (single-thread → trivial)
  // ---------------------------------------------------------------------------

  async appendInChain(
    tenantId: string,
    agentId:  string,
    compute:  (prevHash: string) => AuditEventInsert,
  ): Promise<AuditEventEntity> {
    const events   = this.eventsFor(tenantId, agentId)
    const prevHash = events.length > 0
      ? events[events.length - 1].hash
      : GENESIS_PREV_HASH

    const insert = compute(prevHash)

    const entity: AuditEventEntity = {
      ...insert,
      id:        uuidv4(),
      createdAt: new Date(),
    }

    this.store.push(entity)
    return entity
  }

  // ---------------------------------------------------------------------------
  // iterateChain — retorna em ordem cronológica, filtrando por tenant + agent
  // ---------------------------------------------------------------------------

  async *iterateChain(
    tenantId:  string,
    agentId:   string,
    _batchSize: number,
  ): AsyncIterable<AuditEventEntity> {
    for (const e of this.eventsFor(tenantId, agentId)) {
      yield e
    }
  }

  // ---------------------------------------------------------------------------
  // list — leitura paginada com filtros (implementação in-memory para testes)
  // ---------------------------------------------------------------------------

  async list(tenantId: string, filter: AuditEventFilter): Promise<AuditEventPage> {
    const page  = Math.max(1, filter.page  ?? 1)
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20))

    let events = this.store.filter(e => e.tenantId === tenantId)

    if (filter.agentId) events = events.filter(e => e.agentId  === filter.agentId)
    if (filter.outcome) events = events.filter(e => e.outcome   === filter.outcome as Outcome)
    if (filter.from)    events = events.filter(e => e.createdAt >= filter.from!)
    if (filter.to)      events = events.filter(e => e.createdAt <= filter.to!)

    events = events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    const total = events.length
    const data  = events.slice((page - 1) * limit, page * limit)

    return { data, total, page, limit }
  }

  // ---------------------------------------------------------------------------
  // listForExport — lista completa sem paginação (in-memory)
  // ---------------------------------------------------------------------------

  async listForExport(
    tenantId: string,
    filter:   Omit<AuditEventFilter, 'page' | 'limit'>,
  ): Promise<AuditEventEntity[]> {
    let events = this.store.filter(e => e.tenantId === tenantId)

    if (filter.agentId) events = events.filter(e => e.agentId  === filter.agentId)
    if (filter.outcome) events = events.filter(e => e.outcome   === filter.outcome as Outcome)
    if (filter.from)    events = events.filter(e => e.createdAt >= filter.from!)
    if (filter.to)      events = events.filter(e => e.createdAt <= filter.to!)

    return events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  // ---------------------------------------------------------------------------
  // countSince — conta eventos do agente a partir de `from`
  // ---------------------------------------------------------------------------

  async countSince(tenantId: string, agentId: string, from: Date): Promise<number> {
    return this.store.filter(
      e => e.tenantId === tenantId && e.agentId === agentId && e.createdAt >= from,
    ).length
  }

  // ---------------------------------------------------------------------------
  // countByOutcomeSince — conta eventos por outcome a partir de `from`
  // ---------------------------------------------------------------------------

  async countByOutcomeSince(
    tenantId: string,
    agentId:  string,
    outcome:  Outcome,
    from:     Date,
  ): Promise<number> {
    return this.store.filter(
      e => e.tenantId === tenantId && e.agentId === agentId
        && e.outcome === outcome && e.createdAt >= from,
    ).length
  }

  // ---------------------------------------------------------------------------
  // helpers internos
  // ---------------------------------------------------------------------------

  private eventsFor(tenantId: string, agentId: string): AuditEventEntity[] {
    // Usa sort estável por createdAt apenas — quando timestamps são iguais
    // (comum em testes single-thread), a ordem de inserção é preservada.
    // Array.prototype.sort é estável desde Node 12+ (V8 7.0+).
    return this.store
      .filter(e => e.tenantId === tenantId && e.agentId === agentId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }
}
