// ============================================================
// prisma-alert.repository.ts — ADAPTER (hexagonal)
//
// Implementa AlertRepository delegando ao PrismaClient.
// Único lugar autorizado a importar @prisma/client dentro
// do módulo alerts.
//
// Invariantes:
//   - TODA query filtra por tenantId (isolamento multi-tenant)
//   - list retorna alertas do mais recente ao mais antigo
//   - listThresholds preenche kinds ausentes com DEFAULT_THRESHOLDS
//   - upsertThreshold usa prisma.alertThreshold.upsert (atomic)
// ============================================================

import { randomUUID }   from 'crypto'

import type {
  AlertRepository,
  AlertFilter,
  AlertPage,
} from '../domain/alert-repository.port'
import type {
  Alert,
  AlertKind,
  AlertStatus,
  AlertThreshold,
} from '../domain/alert.types'
import { ALERT_KINDS, DEFAULT_THRESHOLDS } from '../domain/alert.types'

// ─── Tipos de row Prisma ──────────────────────────────────────────────────────

type AlertRow = {
  id:        string
  tenantId:  string
  agentId:   string
  kind:      string
  severity:  string
  status:    string
  message:   string
  metadata:  unknown
  createdAt: Date
  updatedAt: Date
}

type ThresholdRow = {
  id:                  string
  tenantId:            string
  kind:                string
  enabled:             boolean
  errorRatePercent:    number | null
  volumePerHour:       number | null
  checkpointExpiryMin: number | null
  updatedAt:           Date
}

// ─── Interface mínima do PrismaClient para este adapter ───────────────────────
//
// PrismaClient só conhece `alert` e `alertThreshold` após `prisma generate`
// (que requer binários — bloqueado na sandbox). Esta interface estrutural
// descreve exatamente os métodos usados aqui. O cast em server.ts
// (`prisma as unknown as AlertPrismaClient`) pode ser removido após
// o primeiro `prisma generate` em máquina com acesso à rede.

export interface AlertPrismaClient {
  alert: {
    findMany(args: object): Promise<AlertRow[]>
    findFirst(args: object): Promise<AlertRow | null>
    count(args: object): Promise<number>
    create(args: object): Promise<AlertRow>
    update(args: object): Promise<AlertRow>
  }
  alertThreshold: {
    findMany(args: object): Promise<ThresholdRow[]>
    upsert(args: object): Promise<ThresholdRow>
  }
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class PrismaAlertRepository implements AlertRepository {
  constructor(private readonly prisma: AlertPrismaClient) {}

  // ---------------------------------------------------------------------------
  // list — paginação + filtros, do mais recente ao mais antigo
  // ---------------------------------------------------------------------------

  async list(tenantId: string, filter: AlertFilter): Promise<AlertPage> {
    const page  = Math.max(1, filter.page  ?? 1)
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20))
    const skip  = (page - 1) * limit

    const where = this.buildWhere(tenantId, filter)

    const [rows, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.alert.count({ where }),
    ])

    return {
      data:  (rows as AlertRow[]).map((r) => this.mapAlert(r)),
      total,
      page,
      limit,
    }
  }

  // ---------------------------------------------------------------------------
  // findById — retorna null se não encontrado ou de outro tenant
  // ---------------------------------------------------------------------------

  async findById(tenantId: string, id: string): Promise<Alert | null> {
    const row = await this.prisma.alert.findFirst({
      where: { id, tenantId },
    })
    return row ? this.mapAlert(row as AlertRow) : null
  }

  // ---------------------------------------------------------------------------
  // create — persiste novo alerta
  // ---------------------------------------------------------------------------

  async create(input: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Promise<Alert> {
    const row = await this.prisma.alert.create({
      data: {
        id:       randomUUID(),
        tenantId: input.tenantId,
        agentId:  input.agentId,
        kind:     input.kind,
        severity: input.severity,
        status:   input.status,
        message:  input.message,
        metadata: input.metadata as object,
      },
    })
    return this.mapAlert(row as AlertRow)
  }

  // ---------------------------------------------------------------------------
  // updateStatus — OPEN → ACKNOWLEDGED → RESOLVED
  // ---------------------------------------------------------------------------

  async updateStatus(tenantId: string, id: string, status: AlertStatus): Promise<Alert> {
    const row = await this.prisma.alert.update({
      where: { id },
      data:  { status, updatedAt: new Date() },
    })

    // Verificação de isolamento multi-tenant (Prisma update não filtra por tenantId)
    if ((row as AlertRow).tenantId !== tenantId) {
      throw new Error(`Alert ${id} não pertence ao tenant ${tenantId}`)
    }

    return this.mapAlert(row as AlertRow)
  }

  // ---------------------------------------------------------------------------
  // listThresholds — preenche kinds ausentes com defaults (sem persistir)
  // ---------------------------------------------------------------------------

  async listThresholds(tenantId: string): Promise<AlertThreshold[]> {
    const rows = await this.prisma.alertThreshold.findMany({
      where:   { tenantId },
      orderBy: { kind: 'asc' },
    }) as ThresholdRow[]

    const stored = rows.map((r) => this.mapThreshold(r))

    // preenche kinds ausentes com defaults (comportamento idêntico ao in-memory)
    const result: AlertThreshold[] = [...stored]
    for (const kind of ALERT_KINDS) {
      if (!stored.find((t) => t.kind === kind)) {
        const def = DEFAULT_THRESHOLDS.find((d) => d.kind === kind)!
        result.push({
          id:        randomUUID(),
          tenantId,
          updatedAt: new Date(),
          ...def,
        })
      }
    }

    // mantém ordem canônica de ALERT_KINDS
    return result.sort((a, b) => ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind))
  }

  // ---------------------------------------------------------------------------
  // upsertThreshold — cria ou atualiza threshold por (tenantId, kind)
  // ---------------------------------------------------------------------------

  async upsertThreshold(
    tenantId: string,
    kind:     AlertKind,
    patch:    Partial<Omit<AlertThreshold, 'id' | 'tenantId' | 'kind' | 'updatedAt'>>,
  ): Promise<AlertThreshold> {
    const def = DEFAULT_THRESHOLDS.find((d) => d.kind === kind)!

    const row = await this.prisma.alertThreshold.upsert({
      where:  { tenantId_kind: { tenantId, kind } },
      update: {
        ...(patch.enabled             !== undefined ? { enabled:             patch.enabled             } : {}),
        ...(patch.errorRatePercent    !== undefined ? { errorRatePercent:    patch.errorRatePercent    } : {}),
        ...(patch.volumePerHour       !== undefined ? { volumePerHour:       patch.volumePerHour       } : {}),
        ...(patch.checkpointExpiryMin !== undefined ? { checkpointExpiryMin: patch.checkpointExpiryMin } : {}),
        updatedAt: new Date(),
      },
      create: {
        id:                  randomUUID(),
        tenantId,
        kind,
        enabled:             patch.enabled             ?? def.enabled,
        errorRatePercent:    patch.errorRatePercent    ?? def.errorRatePercent    ?? null,
        volumePerHour:       patch.volumePerHour       ?? def.volumePerHour       ?? null,
        checkpointExpiryMin: patch.checkpointExpiryMin ?? def.checkpointExpiryMin ?? null,
        updatedAt: new Date(),
      },
    }) as ThresholdRow

    return this.mapThreshold(row)
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  private buildWhere(tenantId: string, filter: AlertFilter) {
    return {
      tenantId,
      ...(filter.agentId ? { agentId: filter.agentId } : {}),
      ...(filter.kind    ? { kind:    filter.kind    } : {}),
      ...(filter.status  ? { status:  filter.status  } : {}),
      ...((filter.from || filter.to) ? {
        createdAt: {
          ...(filter.from ? { gte: filter.from } : {}),
          ...(filter.to   ? { lte: filter.to   } : {}),
        },
      } : {}),
    }
  }

  private mapAlert(row: AlertRow): Alert {
    return {
      id:        row.id,
      tenantId:  row.tenantId,
      agentId:   row.agentId,
      kind:      row.kind     as AlertKind,
      severity:  row.severity as Alert['severity'],
      status:    row.status   as AlertStatus,
      message:   row.message,
      metadata:  (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  private mapThreshold(row: ThresholdRow): AlertThreshold {
    return {
      id:                  row.id,
      tenantId:            row.tenantId,
      kind:                row.kind                as AlertKind,
      enabled:             row.enabled,
      errorRatePercent:    row.errorRatePercent,
      volumePerHour:       row.volumePerHour,
      checkpointExpiryMin: row.checkpointExpiryMin,
      updatedAt:           row.updatedAt,
    }
  }
}
