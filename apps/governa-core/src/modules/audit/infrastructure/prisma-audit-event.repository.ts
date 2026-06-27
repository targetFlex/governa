import type { PrismaClient } from '@prisma/client'

import type { AuditEventEntity }                    from '../domain/audit-event.entity'
import type {
  AuditEventInsert,
  AuditEventFilter,
  AuditEventPage,
  AuditEventRepository,
} from '../domain/audit-event-repository.port'
import type { Outcome }                              from '../domain/outcome'

import { GENESIS_PREV_HASH } from '../application/hash-chain'

/**
 * PrismaAuditEventRepository — ADAPTER (hexagonal).
 *
 * Implementa AuditEventRepository delegando ao PrismaClient.
 * Único lugar autorizado a importar @prisma/client dentro do módulo audit.
 *
 * Invariantes obrigatórios (LGPD + integridade):
 *   - TODA query filtra por tenantId — sem exceção
 *   - appendInChain executa dentro de transação serializada via
 *     advisory lock por (tenantId, agentId): garante que lastHash +
 *     insert formem cadeia íntegra mesmo sob concorrência
 *   - iterateChain usa cursor pagination (createdAt asc, id asc) —
 *     não carrega todos os eventos em memória
 *
 * O PrismaClient injetado deve apontar para GOVERNA_APP_DATABASE_URL
 * (role append-only) — responsabilidade do composição raiz (DI).
 */
export class PrismaAuditEventRepository implements AuditEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ---------------------------------------------------------------------------
  // lastHashFor — leitura simples, sem lock
  // ---------------------------------------------------------------------------

  async lastHashFor(tenantId: string, agentId: string): Promise<string | null> {
    const last = await this.prisma.auditEvent.findFirst({
      where:   { tenantId, agentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select:  { hash: true },
    })
    return last?.hash ?? null
  }

  // ---------------------------------------------------------------------------
  // appendInChain — transação com advisory lock por (tenantId, agentId)
  //
  // pg_advisory_xact_lock(int4, int4) é liberado automaticamente ao fim
  // da transação. hashtext() é função nativa Postgres que mapeia TEXT → INT4.
  // Usar dois int4 (tenantId + agentId) reduz colisões vs. um único int8.
  // ---------------------------------------------------------------------------

  async appendInChain(
    tenantId: string,
    agentId:  string,
    compute:  (prevHash: string) => AuditEventInsert,
  ): Promise<AuditEventEntity> {
    return this.prisma.$transaction(async (tx) => {
      // Serializa acesso por par (tenantId, agentId).
      // $executeRaw em vez de $queryRaw: pg_advisory_xact_lock retorna void —
      // $queryRaw tenta desserializar a coluna e lança PrismaClientKnownRequestError.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${agentId}))
      `

      const last = await tx.auditEvent.findFirst({
        where:   { tenantId, agentId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select:  { hash: true },
      })

      const prevHash = last?.hash ?? GENESIS_PREV_HASH
      const insert   = compute(prevHash)

      const created = await tx.auditEvent.create({
        data: {
          tenantId:         insert.tenantId,
          agentId:          insert.agentId,
          traceId:          insert.traceId,
          spanId:           insert.spanId        ?? null,
          prevHash:         insert.prevHash,
          hash:             insert.hash,
          action:           insert.action,
          toolCalled:       insert.toolCalled    ?? null,
          inputSummary:     insert.inputSummary,
          outcome:          insert.outcome,
          latencyMs:        insert.latencyMs,
          subjectToken:     insert.subjectToken,
          dataCategories:   insert.dataCategories as string[],
          legalBasis:       insert.legalBasis,
          purpose:          insert.purpose,
          retentionUntil:   insert.retentionUntil,
          approverId:       insert.approverId    ?? null,
          approvedAt:       insert.approvedAt    ?? null,
          escalationReason: insert.escalationReason ?? null,
        },
      })

      return this.mapToEntity(created)
    })
  }

  // ---------------------------------------------------------------------------
  // iterateChain — cursor pagination, createdAt asc + id asc
  //
  // Streaming-friendly: nunca carrega mais que `batchSize` eventos por vez.
  // O cursor usa `id` (UUID, @id) que Prisma suporta nativamente via `cursor`.
  // `skip: 1` pula o próprio cursor (comportamento padrão Prisma).
  // ---------------------------------------------------------------------------

  async *iterateChain(
    tenantId:  string,
    agentId:   string,
    batchSize: number,
  ): AsyncIterable<AuditEventEntity> {
    let cursor: string | undefined = undefined

    while (true) {
      // Prisma 5 + TS: conditional expression causa TS7022 — type assertion explícita necessária
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const batch: Awaited<ReturnType<typeof this.prisma.auditEvent.findMany>> = cursor
        ? await this.prisma.auditEvent.findMany({
            where:   { tenantId, agentId },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take:    batchSize,
            cursor:  { id: cursor },
            skip:    1,
          })
        : await this.prisma.auditEvent.findMany({
            where:   { tenantId, agentId },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take:    batchSize,
          })

      for (const row of batch) {
        yield this.mapToEntity(row)
      }

      if (batch.length < batchSize) break
      cursor = batch[batch.length - 1].id
    }
  }

  // ---------------------------------------------------------------------------
  // list — leitura paginada com filtros (UI / DPO)
  // ---------------------------------------------------------------------------

  async list(tenantId: string, filter: AuditEventFilter): Promise<AuditEventPage> {
    const page  = Math.max(1, filter.page  ?? 1)
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20))
    const skip  = (page - 1) * limit

    const where = this.buildWhere(tenantId, filter)

    const [rows, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.auditEvent.count({ where }),
    ])

    return {
      data:  rows.map((r) => this.mapToEntity(r)),
      total,
      page,
      limit,
    }
  }

  // ---------------------------------------------------------------------------
  // listForExport — sem paginação, máx 10 000 linhas para exportação PDF
  // ---------------------------------------------------------------------------

  async listForExport(
    tenantId: string,
    filter:   Omit<AuditEventFilter, 'page' | 'limit'>,
  ): Promise<AuditEventEntity[]> {
    const where = this.buildWhere(tenantId, filter)

    const rows = await this.prisma.auditEvent.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 10_000,
    })

    return rows.map((r) => this.mapToEntity(r))
  }

  // ---------------------------------------------------------------------------
  // countSince — conta eventos do agente a partir de `from`
  // ---------------------------------------------------------------------------

  async countSince(tenantId: string, agentId: string, from: Date): Promise<number> {
    return this.prisma.auditEvent.count({
      where: { tenantId, agentId, createdAt: { gte: from } },
    })
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
    return this.prisma.auditEvent.count({
      where: { tenantId, agentId, outcome, createdAt: { gte: from } },
    })
  }

  // ---------------------------------------------------------------------------
  // buildWhere — monta cláusula where Prisma com isolamento tenantId
  // ---------------------------------------------------------------------------

  private buildWhere(
    tenantId: string,
    filter:   Omit<AuditEventFilter, 'page' | 'limit'>,
  ) {
    return {
      tenantId,
      ...(filter.agentId ? { agentId: filter.agentId } : {}),
      ...(filter.outcome ? { outcome: filter.outcome } : {}),
      ...((filter.from || filter.to) ? {
        createdAt: {
          ...(filter.from ? { gte: filter.from } : {}),
          ...(filter.to   ? { lte: filter.to   } : {}),
        },
      } : {}),
    }
  }

  // ---------------------------------------------------------------------------
  // mapToEntity — converte row Prisma → AuditEventEntity (domínio puro)
  // ---------------------------------------------------------------------------

  private mapToEntity(row: {
    id:               string
    tenantId:         string
    agentId:          string
    traceId:          string
    spanId:           string | null
    prevHash:         string
    hash:             string
    action:           string
    toolCalled:       string | null
    inputSummary:     string
    outcome:          string
    latencyMs:        number
    subjectToken:     string
    dataCategories:   string[]
    legalBasis:       string
    purpose:          string
    retentionUntil:   Date
    approverId:       string | null
    approvedAt:       Date | null
    escalationReason: string | null
    createdAt:        Date
  }): AuditEventEntity {
    return {
      id:               row.id,
      tenantId:         row.tenantId,
      agentId:          row.agentId,
      traceId:          row.traceId,
      spanId:           row.spanId           ?? undefined,
      prevHash:         row.prevHash,
      hash:             row.hash,
      action:           row.action,
      toolCalled:       row.toolCalled       ?? undefined,
      inputSummary:     row.inputSummary,
      outcome:          row.outcome          as Outcome,
      latencyMs:        row.latencyMs,
      subjectToken:     row.subjectToken,
      dataCategories:   row.dataCategories,
      legalBasis:       row.legalBasis,
      purpose:          row.purpose,
      retentionUntil:   row.retentionUntil,
      approverId:       row.approverId       ?? undefined,
      approvedAt:       row.approvedAt       ?? undefined,
      escalationReason: row.escalationReason ?? undefined,
      createdAt:        row.createdAt,
    }
  }
}
