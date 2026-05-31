import { InMemoryAuditEventRepository } from '../../../../test/fixtures/in-memory-audit-event.repository'
import { AuditService }                 from './audit.service'
import { InvalidAuditInputError }       from './audit.errors'
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
    inputSummary:   'Consulta do pedido numero 42',
    outcome:        'EXECUTADO',
    latencyMs:      100,
    subjectToken:   'a'.repeat(64),
    dataCategories: ['identificacao'],
    legalBasis:     'execucao_contrato',
    purpose:        'consulta_status',
    ...overrides,
  }
}

function makeService(overrides?: { now?: () => Date }) {
  const repo    = new InMemoryAuditEventRepository()
  const service = new AuditService(
    repo,
    undefined,
    overrides?.now ? { now: overrides.now } : undefined,
  )
  return { repo, service }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AuditService', () => {
  // ---- happy path ----------------------------------------------------------

  describe('Given a valid input', () => {
    it('When createEvent is called, Then it returns a persisted AuditEventEntity', async () => {
      const { service } = makeService()
      const event = await service.createEvent(makeInput())

      expect(event.id).toBeDefined()
      expect(event.tenantId).toBe('tenant-A')
      expect(event.agentId).toBe('agent-1')
      expect(event.action).toBe('read_pedido')
      expect(event.outcome).toBe('EXECUTADO')
    })

    it('When createEvent is called, Then traceId is a UUID v4 generated server-side', async () => {
      const { service } = makeService()
      const event = await service.createEvent(makeInput())
      expect(event.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )
    })

    it('When createEvent is called, Then hash is a 64-char hex (SHA-256)', async () => {
      const { service } = makeService()
      const event = await service.createEvent(makeInput())
      expect(event.hash).toHaveLength(64)
      expect(event.hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('When first event of a chain, Then prevHash is GENESIS_PREV_HASH', async () => {
      const { service } = makeService()
      const event = await service.createEvent(makeInput())
      expect(event.prevHash).toBe(GENESIS_PREV_HASH)
    })

    it('When second event of a chain, Then prevHash equals hash of first event', async () => {
      const { service } = makeService()
      const first  = await service.createEvent(makeInput())
      const second = await service.createEvent(makeInput())
      expect(second.prevHash).toBe(first.hash)
    })

    it('When clock is injected, Then retentionUntil is exactly 5 years from now()', async () => {
      const fixed = new Date('2026-01-01T00:00:00.000Z')
      const { service } = makeService({ now: () => fixed })
      const event = await service.createEvent(makeInput())
      // getUTCFullYear() garante consistência independente do fuso do runner de CI.
      expect(event.retentionUntil.getUTCFullYear()).toBe(2031)
    })

    it('When optional spanId is provided, Then it is preserved in the event', async () => {
      const { service } = makeService()
      const event = await service.createEvent(makeInput({ spanId: 'span-xyz' }))
      expect(event.spanId).toBe('span-xyz')
    })

    it('When optional toolCalled is provided, Then it is preserved', async () => {
      const { service } = makeService()
      const event = await service.createEvent(makeInput({ toolCalled: 'protheus_api' }))
      expect(event.toolCalled).toBe('protheus_api')
    })

    it('When events from different agents in same tenant, Then chains are independent', async () => {
      const { service } = makeService()
      const e1 = await service.createEvent(makeInput({ agentId: 'agent-1' }))
      const e2 = await service.createEvent(makeInput({ agentId: 'agent-2' }))

      expect(e1.prevHash).toBe(GENESIS_PREV_HASH)
      expect(e2.prevHash).toBe(GENESIS_PREV_HASH)
      expect(e1.hash).not.toBe(e2.hash)
    })
  })

  // ---- validation ----------------------------------------------------------

  describe('Given an invalid input', () => {
    it('When tenantId is empty, Then throws InvalidAuditInputError', async () => {
      const { service } = makeService()
      await expect(service.createEvent(makeInput({ tenantId: '' })))
        .rejects.toBeInstanceOf(InvalidAuditInputError)
    })

    it('When agentId is empty, Then throws InvalidAuditInputError', async () => {
      const { service } = makeService()
      await expect(service.createEvent(makeInput({ agentId: '' })))
        .rejects.toBeInstanceOf(InvalidAuditInputError)
    })

    it('When action is empty, Then throws InvalidAuditInputError', async () => {
      const { service } = makeService()
      await expect(service.createEvent(makeInput({ action: '' })))
        .rejects.toBeInstanceOf(InvalidAuditInputError)
    })

    it('When inputSummary is empty, Then throws InvalidAuditInputError', async () => {
      const { service } = makeService()
      await expect(service.createEvent(makeInput({ inputSummary: '' })))
        .rejects.toBeInstanceOf(InvalidAuditInputError)
    })

    it('When subjectToken is empty, Then throws InvalidAuditInputError', async () => {
      const { service } = makeService()
      await expect(service.createEvent(makeInput({ subjectToken: '' })))
        .rejects.toBeInstanceOf(InvalidAuditInputError)
    })

    it('When legalBasis is empty, Then throws InvalidAuditInputError', async () => {
      const { service } = makeService()
      await expect(service.createEvent(makeInput({ legalBasis: '' })))
        .rejects.toBeInstanceOf(InvalidAuditInputError)
    })

    it('When purpose is empty, Then throws InvalidAuditInputError', async () => {
      const { service } = makeService()
      await expect(service.createEvent(makeInput({ purpose: '' })))
        .rejects.toBeInstanceOf(InvalidAuditInputError)
    })

    it('When latencyMs is negative, Then throws InvalidAuditInputError', async () => {
      const { service } = makeService()
      await expect(service.createEvent(makeInput({ latencyMs: -1 })))
        .rejects.toBeInstanceOf(InvalidAuditInputError)
    })

    it('When dataCategories is empty array, Then throws InvalidAuditInputError', async () => {
      const { service } = makeService()
      await expect(service.createEvent(makeInput({ dataCategories: [] })))
        .rejects.toBeInstanceOf(InvalidAuditInputError)
    })
  })

  // ---- PII gate ------------------------------------------------------------

  describe('Given inputSummary with PII', () => {
    it('When inputSummary contains email, Then throws (PiiDetectedError)', async () => {
      const { service } = makeService()
      await expect(
        service.createEvent(makeInput({ inputSummary: 'Agente leu usuario@empresa.com' })),
      ).rejects.toThrow(/PII detected/)
    })

    it('When inputSummary contains CPF, Then throws (PiiDetectedError)', async () => {
      const { service } = makeService()
      await expect(
        service.createEvent(makeInput({ inputSummary: 'Dados do CPF 123.456.789-09' })),
      ).rejects.toThrow(/PII detected/)
    })
  })
})
