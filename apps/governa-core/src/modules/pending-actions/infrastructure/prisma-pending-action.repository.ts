import { randomUUID } from 'crypto'

import type { PendingActionRepository, CreatePendingActionInput, ApprovePendingActionInput } from '../domain/pending-action-repository.port'
import type { PendingAction, PendingActionPayload, PendingActionStatus } from '../domain/pending-action.entity'

// ─── Interface mínima do PrismaClient para este adapter ──────────────────────

type PendingActionRow = {
  id:         string
  tenantId:   string
  agentId:    string
  toolName:   string
  payload:    unknown
  status:     string
  approverId: string | null
  expiresAt:  Date
  createdAt:  Date
  resolvedAt: Date | null
}

export interface PendingActionPrismaClient {
  pendingAction: {
    create(args: object): Promise<PendingActionRow>
    findFirst(args: object): Promise<PendingActionRow | null>
    findMany(args: object): Promise<PendingActionRow[]>
    update(args: object): Promise<PendingActionRow>
    updateMany(args: object): Promise<{ count: number }>
  }
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class PrismaPendingActionRepository implements PendingActionRepository {
  constructor(private readonly prisma: PendingActionPrismaClient) {}

  async create(input: CreatePendingActionInput): Promise<PendingAction> {
    const row = await this.prisma.pendingAction.create({
      data: {
        id:        randomUUID(),
        tenantId:  input.tenantId,
        agentId:   input.agentId,
        toolName:  input.toolName,
        payload:   input.payload as object,
        status:    'PENDING',
        expiresAt: input.expiresAt,
      },
    })
    return this.mapRow(row)
  }

  async findById(id: string, tenantId: string): Promise<PendingAction | null> {
    const row = await this.prisma.pendingAction.findFirst({ where: { id, tenantId } })
    return row ? this.mapRow(row) : null
  }

  async findPendingByTenant(tenantId: string): Promise<PendingAction[]> {
    const rows = await this.prisma.pendingAction.findMany({
      where:   { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    })
    return (rows as PendingActionRow[]).map(r => this.mapRow(r))
  }

  async approve(id: string, tenantId: string, input: ApprovePendingActionInput): Promise<PendingAction> {
    const row = await this.prisma.pendingAction.update({
      where: { id },
      data: {
        status:     'APPROVED',
        approverId: input.approverId,
        resolvedAt: new Date(),
      },
    })
    if ((row as PendingActionRow).tenantId !== tenantId) {
      throw new Error(`PendingAction ${id} não pertence ao tenant ${tenantId}`)
    }
    return this.mapRow(row)
  }

  async reject(id: string, tenantId: string, approverId: string): Promise<PendingAction> {
    const row = await this.prisma.pendingAction.update({
      where: { id },
      data: {
        status:     'REJECTED',
        approverId,
        resolvedAt: new Date(),
      },
    })
    if ((row as PendingActionRow).tenantId !== tenantId) {
      throw new Error(`PendingAction ${id} não pertence ao tenant ${tenantId}`)
    }
    return this.mapRow(row)
  }

  async expireStale(before: Date): Promise<number> {
    const result = await this.prisma.pendingAction.updateMany({
      where:  { status: 'PENDING', expiresAt: { lt: before } },
      data:   { status: 'EXPIRED', resolvedAt: new Date() },
    })
    return (result as { count: number }).count
  }

  private mapRow(row: PendingActionRow): PendingAction {
    return {
      id:         row.id,
      tenantId:   row.tenantId,
      agentId:    row.agentId,
      toolName:   row.toolName,
      payload:    row.payload as PendingActionPayload,
      status:     row.status as PendingActionStatus,
      approverId: row.approverId,
      expiresAt:  row.expiresAt,
      createdAt:  row.createdAt,
      resolvedAt: row.resolvedAt,
    }
  }
}
