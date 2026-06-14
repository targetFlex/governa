// ============================================================
// prisma-alert.repository.spec.ts — TDD
//
// Testa PrismaAlertRepository com mock manual do PrismaClient.
// Zero dependência de banco real — todos os métodos da porta
// cobertos, incluindo isolamento multi-tenant.
// ============================================================

import { PrismaAlertRepository } from './prisma-alert.repository'
import type { Alert, AlertThreshold } from '../domain/alert.types'
import { ALERT_KINDS } from '../domain/alert.types'

// ─── Helpers de fixtures ───────────────────────────────────────────────────

function makeAlertRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:        'alert-1',
    tenantId:  'tenant-a',
    agentId:   'agent-1',
    kind:      'ERROR_RATE',
    severity:  'HIGH',
    status:    'OPEN',
    message:   'Taxa de erro elevada',
    metadata:  { errorRate: 12 },
    createdAt: new Date('2026-06-14T10:00:00Z'),
    updatedAt: new Date('2026-06-14T10:00:00Z'),
    ...overrides,
  }
}

function makeThresholdRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:                  'thr-1',
    tenantId:            'tenant-a',
    kind:                'ERROR_RATE',
    enabled:             true,
    errorRatePercent:    10,
    volumePerHour:       null,
    checkpointExpiryMin: null,
    updatedAt:           new Date('2026-06-14T10:00:00Z'),
    ...overrides,
  }
}

// ─── Mock do PrismaClient ──────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    alert: {
      findMany:  jest.fn(),
      findFirst: jest.fn(),
      count:     jest.fn(),
      create:    jest.fn(),
      update:    jest.fn(),
    },
    alertThreshold: {
      findMany: jest.fn(),
      upsert:   jest.fn(),
    },
    ...overrides,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// ─── Testes ───────────────────────────────────────────────────────────────

describe('PrismaAlertRepository', () => {
  const TENANT = 'tenant-a'
  const OTHER  = 'tenant-b'

  // ── list ────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('retorna página com dados e total', async () => {
      const row    = makeAlertRow()
      const prisma = makePrisma()
      prisma.alert.findMany.mockResolvedValue([row])
      prisma.alert.count.mockResolvedValue(1)

      const repo = new PrismaAlertRepository(prisma)
      const page = await repo.list(TENANT, {})

      expect(page.total).toBe(1)
      expect(page.data).toHaveLength(1)
      expect(page.data[0].id).toBe('alert-1')
      expect(page.data[0].kind).toBe('ERROR_RATE')
    })

    it('aplica paginação padrão page=1 limit=20', async () => {
      const prisma = makePrisma()
      prisma.alert.findMany.mockResolvedValue([])
      prisma.alert.count.mockResolvedValue(0)

      const repo = new PrismaAlertRepository(prisma)
      await repo.list(TENANT, {})

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      )
    })

    it('limita limit a 100', async () => {
      const prisma = makePrisma()
      prisma.alert.findMany.mockResolvedValue([])
      prisma.alert.count.mockResolvedValue(0)

      const repo = new PrismaAlertRepository(prisma)
      await repo.list(TENANT, { limit: 999 })

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      )
    })

    it('filtra por tenantId sempre', async () => {
      const prisma = makePrisma()
      prisma.alert.findMany.mockResolvedValue([])
      prisma.alert.count.mockResolvedValue(0)

      const repo = new PrismaAlertRepository(prisma)
      await repo.list(TENANT, { kind: 'ERROR_RATE', status: 'OPEN', agentId: 'agent-1' })

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT, kind: 'ERROR_RATE', status: 'OPEN', agentId: 'agent-1' }),
        }),
      )
    })

    it('filtra por intervalo de datas', async () => {
      const from = new Date('2026-06-01')
      const to   = new Date('2026-06-14')
      const prisma = makePrisma()
      prisma.alert.findMany.mockResolvedValue([])
      prisma.alert.count.mockResolvedValue(0)

      const repo = new PrismaAlertRepository(prisma)
      await repo.list(TENANT, { from, to })

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdAt: { gte: from, lte: to } }),
        }),
      )
    })

    it('mapeia metadata como Record<string, unknown>', async () => {
      const row = makeAlertRow({ metadata: { errorRate: 15, toolName: 'criar-pedido' } })
      const prisma = makePrisma()
      prisma.alert.findMany.mockResolvedValue([row])
      prisma.alert.count.mockResolvedValue(1)

      const repo = new PrismaAlertRepository(prisma)
      const page = await repo.list(TENANT, {})

      expect(page.data[0].metadata).toEqual({ errorRate: 15, toolName: 'criar-pedido' })
    })
  })

  // ── findById ────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('retorna alerta quando encontrado', async () => {
      const row    = makeAlertRow()
      const prisma = makePrisma()
      prisma.alert.findFirst.mockResolvedValue(row)

      const repo  = new PrismaAlertRepository(prisma)
      const alert = await repo.findById(TENANT, 'alert-1')

      expect(alert).not.toBeNull()
      expect(alert!.id).toBe('alert-1')
      expect(prisma.alert.findFirst).toHaveBeenCalledWith({
        where: { id: 'alert-1', tenantId: TENANT },
      })
    })

    it('retorna null quando não encontrado', async () => {
      const prisma = makePrisma()
      prisma.alert.findFirst.mockResolvedValue(null)

      const repo  = new PrismaAlertRepository(prisma)
      const alert = await repo.findById(TENANT, 'inexistente')

      expect(alert).toBeNull()
    })

    it('isolamento: filtra por tenantId no where', async () => {
      const prisma = makePrisma()
      prisma.alert.findFirst.mockResolvedValue(null)

      const repo = new PrismaAlertRepository(prisma)
      await repo.findById(OTHER, 'alert-1')

      expect(prisma.alert.findFirst).toHaveBeenCalledWith({
        where: { id: 'alert-1', tenantId: OTHER },
      })
    })
  })

  // ── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('persiste alerta e retorna com id/timestamps', async () => {
      const now = new Date('2026-06-14T11:00:00Z')
      const prisma = makePrisma()
      prisma.alert.create.mockResolvedValue(makeAlertRow({
        id: 'new-uuid', createdAt: now, updatedAt: now,
      }))

      const repo  = new PrismaAlertRepository(prisma)
      const input = {
        tenantId: TENANT,
        agentId:  'agent-1',
        kind:     'ERROR_RATE'    as const,
        severity: 'HIGH'         as const,
        status:   'OPEN'         as const,
        message:  'Taxa elevada',
        metadata: { errorRate: 12 },
      }
      const alert = await repo.create(input)

      expect(alert.id).toBe('new-uuid')
      expect(alert.createdAt).toEqual(now)
      expect(prisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: TENANT, kind: 'ERROR_RATE' }),
        }),
      )
    })

    it('gera UUID próprio (não usa id do input)', async () => {
      const prisma = makePrisma()
      prisma.alert.create.mockResolvedValue(makeAlertRow())

      const repo = new PrismaAlertRepository(prisma)
      await repo.create({
        tenantId: TENANT, agentId: 'agent-1',
        kind: 'TOOL_BLOCKED', severity: 'MEDIUM', status: 'OPEN',
        message: 'Tool bloqueada', metadata: {},
      })

      const { data } = prisma.alert.create.mock.calls[0][0]
      // UUID gerado pelo repositório — deve ser string não vazia
      expect(typeof data.id).toBe('string')
      expect(data.id.length).toBeGreaterThan(0)
    })
  })

  // ── updateStatus ────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('atualiza status e retorna alerta atualizado', async () => {
      const updated = makeAlertRow({ status: 'ACKNOWLEDGED' })
      const prisma  = makePrisma()
      prisma.alert.update.mockResolvedValue(updated)

      const repo  = new PrismaAlertRepository(prisma)
      const alert = await repo.updateStatus(TENANT, 'alert-1', 'ACKNOWLEDGED')

      expect(alert.status).toBe('ACKNOWLEDGED')
      expect(prisma.alert.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'alert-1' } }),
      )
    })

    it('lança erro se tenantId do row retornado for diferente', async () => {
      const wrongTenantRow = makeAlertRow({ tenantId: OTHER })
      const prisma = makePrisma()
      prisma.alert.update.mockResolvedValue(wrongTenantRow)

      const repo = new PrismaAlertRepository(prisma)
      await expect(
        repo.updateStatus(TENANT, 'alert-1', 'RESOLVED'),
      ).rejects.toThrow(`Alert alert-1 não pertence ao tenant ${TENANT}`)
    })
  })

  // ── listThresholds ──────────────────────────────────────────────────────

  describe('listThresholds', () => {
    it('retorna thresholds persistidos mapeados', async () => {
      const row    = makeThresholdRow()
      const prisma = makePrisma()
      prisma.alertThreshold.findMany.mockResolvedValue([row])

      const repo       = new PrismaAlertRepository(prisma)
      const thresholds = await repo.listThresholds(TENANT)

      // deve conter o threshold persistido + defaults para kinds ausentes
      const found = thresholds.find((t) => t.kind === 'ERROR_RATE')
      expect(found).toBeDefined()
      expect(found!.errorRatePercent).toBe(10)
    })

    it('preenche kinds ausentes com defaults', async () => {
      const prisma = makePrisma()
      // retorna apenas ERROR_RATE persistido
      prisma.alertThreshold.findMany.mockResolvedValue([makeThresholdRow()])

      const repo       = new PrismaAlertRepository(prisma)
      const thresholds = await repo.listThresholds(TENANT)

      // todos os 4 kinds devem estar presentes
      expect(thresholds).toHaveLength(ALERT_KINDS.length)
      const kinds = thresholds.map((t) => t.kind)
      for (const k of ALERT_KINDS) {
        expect(kinds).toContain(k)
      }
    })

    it('retorna vazio do banco → todos os 4 kinds com defaults', async () => {
      const prisma = makePrisma()
      prisma.alertThreshold.findMany.mockResolvedValue([])

      const repo       = new PrismaAlertRepository(prisma)
      const thresholds = await repo.listThresholds(TENANT)

      expect(thresholds).toHaveLength(4)
      const thr = thresholds.find((t) => t.kind === 'CHECKPOINT_EXPIRED')!
      expect(thr.checkpointExpiryMin).toBe(60)
      expect(thr.enabled).toBe(true)
    })

    it('mantém ordem canônica de ALERT_KINDS', async () => {
      const prisma = makePrisma()
      prisma.alertThreshold.findMany.mockResolvedValue([])

      const repo       = new PrismaAlertRepository(prisma)
      const thresholds = await repo.listThresholds(TENANT)
      const kinds      = thresholds.map((t) => t.kind)

      expect(kinds).toEqual([...ALERT_KINDS])
    })

    it('filtra por tenantId', async () => {
      const prisma = makePrisma()
      prisma.alertThreshold.findMany.mockResolvedValue([])

      const repo = new PrismaAlertRepository(prisma)
      await repo.listThresholds(OTHER)

      expect(prisma.alertThreshold.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: OTHER } }),
      )
    })
  })

  // ── upsertThreshold ──────────────────────────────────────────────────────

  describe('upsertThreshold', () => {
    it('chama prisma.upsert com where tenantId_kind', async () => {
      const row    = makeThresholdRow({ errorRatePercent: 15 })
      const prisma = makePrisma()
      prisma.alertThreshold.upsert.mockResolvedValue(row)

      const repo = new PrismaAlertRepository(prisma)
      await repo.upsertThreshold(TENANT, 'ERROR_RATE', { errorRatePercent: 15 })

      expect(prisma.alertThreshold.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_kind: { tenantId: TENANT, kind: 'ERROR_RATE' } },
        }),
      )
    })

    it('retorna threshold atualizado com novo valor', async () => {
      const row    = makeThresholdRow({ errorRatePercent: 20 })
      const prisma = makePrisma()
      prisma.alertThreshold.upsert.mockResolvedValue(row)

      const repo = new PrismaAlertRepository(prisma)
      const thr  = await repo.upsertThreshold(TENANT, 'ERROR_RATE', { errorRatePercent: 20 })

      expect(thr.errorRatePercent).toBe(20)
      expect(thr.kind).toBe('ERROR_RATE')
    })

    it('create block usa defaults quando patch não especifica campo', async () => {
      const row    = makeThresholdRow({ kind: 'CHECKPOINT_EXPIRED', checkpointExpiryMin: 60 })
      const prisma = makePrisma()
      prisma.alertThreshold.upsert.mockResolvedValue(row)

      const repo = new PrismaAlertRepository(prisma)
      await repo.upsertThreshold(TENANT, 'CHECKPOINT_EXPIRED', { enabled: false })

      const { create } = prisma.alertThreshold.upsert.mock.calls[0][0]
      // checkpointExpiryMin default = 60
      expect(create.checkpointExpiryMin).toBe(60)
      expect(create.enabled).toBe(false)
    })

    it('update block inclui apenas campos presentes no patch', async () => {
      const row    = makeThresholdRow()
      const prisma = makePrisma()
      prisma.alertThreshold.upsert.mockResolvedValue(row)

      const repo = new PrismaAlertRepository(prisma)
      await repo.upsertThreshold(TENANT, 'ERROR_RATE', { enabled: false })

      const { update } = prisma.alertThreshold.upsert.mock.calls[0][0]
      expect(update.enabled).toBe(false)
      expect(update.errorRatePercent).toBeUndefined()
    })
  })
})
