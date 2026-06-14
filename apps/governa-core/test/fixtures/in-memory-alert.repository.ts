// ============================================================
// in-memory-alert.repository.ts
//
// Implementação in-memory da AlertRepository — uso exclusivo
// em testes. Zero latência, sem Prisma, sem banco.
// ============================================================

import { randomUUID } from 'crypto'
import type { AlertRepository, AlertFilter, AlertPage } from '../../src/modules/alerts/domain/alert-repository.port'
import type { Alert, AlertKind, AlertStatus, AlertThreshold } from '../../src/modules/alerts/domain/alert.types'
import { ALERT_KINDS, DEFAULT_THRESHOLDS } from '../../src/modules/alerts/domain/alert.types'

export class InMemoryAlertRepository implements AlertRepository {
  private alerts:     Alert[]          = []
  private thresholds: AlertThreshold[] = []

  constructor(seed?: { alerts?: Alert[]; thresholds?: AlertThreshold[] }) {
    if (seed?.alerts)     this.alerts     = [...seed.alerts]
    if (seed?.thresholds) this.thresholds = [...seed.thresholds]
  }

  // ── Helpers para testes ────────────────────────────────────────────────────

  seedDefaultThresholds(tenantId: string): void {
    this.thresholds = ALERT_KINDS.map((kind) => {
      const def = DEFAULT_THRESHOLDS.find((d) => d.kind === kind)!
      return {
        id:        randomUUID(),
        tenantId,
        updatedAt: new Date(),
        ...def,
      }
    })
  }

  allAlerts(): Alert[] {
    return [...this.alerts]
  }

  // ── AlertRepository ────────────────────────────────────────────────────────

  async list(tenantId: string, filter: AlertFilter): Promise<AlertPage> {
    let rows = this.alerts
      .filter((a) => a.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    if (filter.agentId) rows = rows.filter((a) => a.agentId === filter.agentId)
    if (filter.kind)    rows = rows.filter((a) => a.kind    === filter.kind)
    if (filter.status)  rows = rows.filter((a) => a.status  === filter.status)
    if (filter.from)    rows = rows.filter((a) => a.createdAt >= filter.from!)
    if (filter.to)      rows = rows.filter((a) => a.createdAt <= filter.to!)

    const total = rows.length
    const page  = filter.page  ?? 1
    const limit = Math.min(filter.limit ?? 20, 100)
    const data  = rows.slice((page - 1) * limit, page * limit)

    return { data, total, page, limit }
  }

  async findById(tenantId: string, id: string): Promise<Alert | null> {
    return this.alerts.find((a) => a.tenantId === tenantId && a.id === id) ?? null
  }

  async create(input: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Promise<Alert> {
    const now   = new Date()
    const alert: Alert = {
      ...input,
      id:        randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    this.alerts.push(alert)
    return alert
  }

  async updateStatus(tenantId: string, id: string, status: AlertStatus): Promise<Alert> {
    const idx = this.alerts.findIndex((a) => a.tenantId === tenantId && a.id === id)
    if (idx === -1) throw new Error(`Alert ${id} não encontrado`)
    this.alerts[idx] = { ...this.alerts[idx], status, updatedAt: new Date() }
    return this.alerts[idx]
  }

  async listThresholds(tenantId: string): Promise<AlertThreshold[]> {
    const stored = this.thresholds.filter((t) => t.tenantId === tenantId)

    // preenche kinds ausentes com defaults
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
    return result.sort((a, b) => ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind))
  }

  async upsertThreshold(
    tenantId: string,
    kind:     AlertKind,
    patch:    Partial<Omit<AlertThreshold, 'id' | 'tenantId' | 'kind' | 'updatedAt'>>,
  ): Promise<AlertThreshold> {
    const idx = this.thresholds.findIndex((t) => t.tenantId === tenantId && t.kind === kind)
    if (idx !== -1) {
      this.thresholds[idx] = { ...this.thresholds[idx], ...patch, updatedAt: new Date() }
      return this.thresholds[idx]
    }

    const def = DEFAULT_THRESHOLDS.find((d) => d.kind === kind)!
    const created: AlertThreshold = {
      ...def,
      ...patch,
      id:        randomUUID(),
      tenantId,
      kind,
      updatedAt: new Date(),
    }
    this.thresholds.push(created)
    return created
  }
}
