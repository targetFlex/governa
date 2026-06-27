/**
 * audit.query.service.spec.ts — TDD para AuditQueryService.
 *
 * Padrão: mock do repositório, sem banco real.
 */

import { AuditQueryService } from './audit.query.service'
import type { AuditEventRepository, AuditEventPage } from '../domain/audit-event-repository.port'
import type { AuditEventEntity } from '../domain/audit-event.entity'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = 'tenant-123'
const AGENT  = 'agent-456'

function makeEvent(partial: Partial<AuditEventEntity> = {}): AuditEventEntity {
  return {
    id:             'evt-1',
    tenantId:       TENANT,
    agentId:        AGENT,
    traceId:        'trace-1',
    prevHash:       'GENESIS',
    hash:           'abc123',
    action:         'read_protheus_pedido',
    inputSummary:   'consulta pedido #42',
    outcome:        'EXECUTADO',
    latencyMs:      120,
    subjectToken:   'sub-token',
    dataCategories: ['pedido'],
    legalBasis:     'Legítimo interesse',
    purpose:        'Atendimento ao cliente',
    retentionUntil: new Date('2031-01-01'),
    createdAt:      new Date('2026-06-01T10:00:00Z'),
    ...partial,
  }
}

function makePage(partial: Partial<AuditEventPage> = {}): AuditEventPage {
  return {
    data:  [makeEvent()],
    total: 1,
    page:  1,
    limit: 20,
    ...partial,
  }
}

// ─── Mock repo ────────────────────────────────────────────────────────────────

function makeRepo(overrides: Partial<AuditEventRepository> = {}): AuditEventRepository {
  return {
    lastHashFor:          jest.fn(),
    appendInChain:        jest.fn(),
    iterateChain:         jest.fn(),
    list:                 jest.fn().mockResolvedValue(makePage()),
    listForExport:        jest.fn().mockResolvedValue([makeEvent()]),
    countSince:           jest.fn().mockResolvedValue(0),
    countByOutcomeSince:  jest.fn().mockResolvedValue(0),
    ...overrides,
  }
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AuditQueryService', () => {

  // AQS-1: listEvents — básico

  describe('AQS-1: listEvents — delega ao repo com tenantId correto', () => {
    it('retorna página do repo', async () => {
      const repo    = makeRepo()
      const service = new AuditQueryService(repo)
      const page    = makePage()
      ;(repo.list as jest.Mock).mockResolvedValue(page)

      const result = await service.listEvents(TENANT, { agentId: AGENT })

      expect(repo.list).toHaveBeenCalledWith(TENANT, { agentId: AGENT })
      expect(result).toBe(page)
    })
  })

  // AQS-2: listEvents — filtros combinados

  describe('AQS-2: listEvents — repassa filtros ao repo', () => {
    it('passa from/to/outcome para repo.list', async () => {
      const repo    = makeRepo()
      const service = new AuditQueryService(repo)
      const from    = new Date('2026-01-01')
      const to      = new Date('2026-06-30')

      await service.listEvents(TENANT, { from, to, outcome: 'BLOQUEADO', page: 2, limit: 50 })

      expect(repo.list).toHaveBeenCalledWith(TENANT, {
        from, to, outcome: 'BLOQUEADO', page: 2, limit: 50,
      })
    })
  })

  // AQS-3: listEvents — tenantId vazio lança erro

  describe('AQS-3: listEvents — tenantId vazio lança erro', () => {
    it('lança Error quando tenantId é string vazia', async () => {
      const repo    = makeRepo()
      const service = new AuditQueryService(repo)

      await expect(service.listEvents('', {})).rejects.toThrow('tenantId é obrigatório')
      expect(repo.list).not.toHaveBeenCalled()
    })
  })

  // AQS-4: exportEvents — básico

  describe('AQS-4: exportEvents — delega ao repo', () => {
    it('retorna lista de eventos do repo', async () => {
      const repo    = makeRepo()
      const service = new AuditQueryService(repo)
      const events  = [makeEvent(), makeEvent({ id: 'evt-2' })]
      ;(repo.listForExport as jest.Mock).mockResolvedValue(events)

      const result = await service.exportEvents(TENANT, { agentId: AGENT })

      expect(repo.listForExport).toHaveBeenCalledWith(TENANT, { agentId: AGENT })
      expect(result).toBe(events)
    })
  })

  // AQS-5: exportEvents — tenantId vazio lança erro

  describe('AQS-5: exportEvents — tenantId vazio lança erro', () => {
    it('lança Error quando tenantId é string vazia', async () => {
      const repo    = makeRepo()
      const service = new AuditQueryService(repo)

      await expect(service.exportEvents('', {})).rejects.toThrow('tenantId é obrigatório')
      expect(repo.listForExport).not.toHaveBeenCalled()
    })
  })

  // AQS-6: exportEvents — sem filtros

  describe('AQS-6: exportEvents — sem filtros retorna todos os eventos', () => {
    it('chama listForExport com filtro vazio {}', async () => {
      const repo    = makeRepo()
      const service = new AuditQueryService(repo)

      await service.exportEvents(TENANT, {})

      expect(repo.listForExport).toHaveBeenCalledWith(TENANT, {})
    })
  })

  // AQS-7: listEvents — filtro só por outcome

  describe('AQS-7: listEvents — filtro por outcome EXECUTADO', () => {
    it('delega outcome ao repo sem outros filtros', async () => {
      const repo    = makeRepo()
      const service = new AuditQueryService(repo)

      await service.listEvents(TENANT, { outcome: 'EXECUTADO' })

      expect(repo.list).toHaveBeenCalledWith(TENANT, { outcome: 'EXECUTADO' })
    })
  })

  // AQS-8: listEvents — paginação padrão (sem filtros)

  describe('AQS-8: listEvents — sem filtros repassa {} ao repo', () => {
    it('chama repo.list com filtro vazio', async () => {
      const repo    = makeRepo()
      const service = new AuditQueryService(repo)

      await service.listEvents(TENANT, {})

      expect(repo.list).toHaveBeenCalledWith(TENANT, {})
    })
  })
})
