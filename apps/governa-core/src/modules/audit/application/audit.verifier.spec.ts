import { InMemoryAuditEventRepository } from '../../../../test/fixtures/in-memory-audit-event.repository'
import { AuditService }                 from './audit.service'
import { AuditVerifier }                from './audit.verifier'
import { GENESIS_PREV_HASH }            from './hash-chain'
import type { CreateAuditEventInput }   from '../domain/create-audit-event-input'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<CreateAuditEventInput> = {}): CreateAuditEventInput {
  return {
    tenantId:       'tenant-A',
    agentId:        'agent-1',
    action:         'read_pedido',
    inputSummary:   'Consulta pedido numero 42',
    outcome:        'EXECUTADO',
    latencyMs:      80,
    subjectToken:   'a'.repeat(64),
    dataCategories: ['identificacao'],
    legalBasis:     'execucao_contrato',
    purpose:        'consulta_status',
    ...overrides,
  }
}

function setup() {
  const repo     = new InMemoryAuditEventRepository()
  const service  = new AuditService(repo)
  const verifier = new AuditVerifier(repo)
  return { repo, service, verifier }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AuditVerifier', () => {
  // ---- empty chain ---------------------------------------------------------

  describe('Given an empty chain', () => {
    it('When verify is called, Then returns valid with totalEvents = 0', async () => {
      const { verifier } = setup()
      const result = await verifier.verify('tenant-A', 'agent-1')
      expect(result.valid).toBe(true)
      expect(result.totalEvents).toBe(0)
      expect(result.brokenAt).toBeUndefined()
    })
  })

  // ---- intact chain --------------------------------------------------------

  describe('Given a chain of 3 intact events', () => {
    it('When verify is called, Then returns valid with totalEvents = 3', async () => {
      const { service, verifier } = setup()
      await service.createEvent(makeInput())
      await service.createEvent(makeInput())
      await service.createEvent(makeInput())

      const result = await verifier.verify('tenant-A', 'agent-1')
      expect(result.valid).toBe(true)
      expect(result.totalEvents).toBe(3)
    })
  })

  // ---- tampered hash -------------------------------------------------------

  describe('Given a chain where an event hash was tampered', () => {
    it('When verify is called, Then returns valid=false for that event', async () => {
      const { repo, service, verifier } = setup()
      const e0 = await service.createEvent(makeInput())
      const e1 = await service.createEvent(makeInput())
      await service.createEvent(makeInput())

      // Substitui e1 com hash adulterado (prevHash correto → só hash falha)
      const all = repo.all()
      repo.clear()
      repo.seed(all[0])
      repo.seed({ ...e1, hash: 'tampered'.padEnd(64, 'x') })
      repo.seed(all[2])

      const result = await verifier.verify('tenant-A', 'agent-1')
      expect(result.valid).toBe(false)
      expect(result.brokenAt).toBe(1)
      expect(result.reason).toMatch(/hash mismatch/)

      // Confirma que e0 era válido (o problema é apenas no index 1)
      expect(e0.prevHash).toBe(GENESIS_PREV_HASH)
    })
  })

  // ---- prevHash mismatch ---------------------------------------------------

  describe('Given a chain where prevHash link is broken', () => {
    it('When verify detects prevHash mismatch, Then returns valid=false with reason', async () => {
      const { repo, service, verifier } = setup()

      const e0 = await service.createEvent(makeInput())
      const e1 = await service.createEvent(makeInput())

      // Adultera somente prevHash de e1 — o hash original fica errado
      // mas prevHash mismatch é verificado primeiro
      repo.clear()
      repo.seed(e0)
      repo.seed({ ...e1, prevHash: 'wrong'.padEnd(64, '0') })

      const result = await verifier.verify('tenant-A', 'agent-1')
      expect(result.valid).toBe(false)
      expect(result.brokenAt).toBe(1)
      expect(result.reason).toMatch(/prevHash mismatch/)
    })
  })

  // ---- tenant isolation ----------------------------------------------------

  describe('Given events from two different tenants', () => {
    it('When verify is called for tenant-A, Then only tenant-A events are checked', async () => {
      const { service, verifier } = setup()
      await service.createEvent(makeInput({ tenantId: 'tenant-A' }))
      await service.createEvent(makeInput({ tenantId: 'tenant-B' }))

      const result = await verifier.verify('tenant-A', 'agent-1')
      expect(result.valid).toBe(true)
      expect(result.totalEvents).toBe(1)
    })
  })

  // ---- batch size ----------------------------------------------------------

  describe('Given a verifier with small batchSize', () => {
    it('When chain has more events than batch, Then all events are verified', async () => {
      const repo     = new InMemoryAuditEventRepository()
      const service  = new AuditService(repo)
      const verifier = new AuditVerifier(repo, 2) // batchSize = 2

      for (let i = 0; i < 5; i++) {
        await service.createEvent(makeInput())
      }

      const result = await verifier.verify('tenant-A', 'agent-1')
      expect(result.valid).toBe(true)
      expect(result.totalEvents).toBe(5)
    })
  })
})
