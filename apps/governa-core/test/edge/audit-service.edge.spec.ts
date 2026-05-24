import { InMemoryAuditEventRepository } from '../fixtures/in-memory-audit-event.repository'
import { AuditService }                 from '../../src/modules/audit/application/audit.service'
import { AuditVerifier }                from '../../src/modules/audit/application/audit.verifier'
import { InvalidAuditInputError }       from '../../src/modules/audit/application/audit.errors'
import { GENESIS_PREV_HASH }            from '../../src/modules/audit/application/hash-chain'
import type { CreateAuditEventInput }   from '../../src/modules/audit/domain/create-audit-event-input'

/**
 * Edge cases — AuditService
 *
 * Isolados em test/edge/ conforme preferência #5.
 * Cobrem comportamentos limite que não cabem na spec unitária principal.
 */

function makeInput(overrides: Partial<CreateAuditEventInput> = {}): CreateAuditEventInput {
  return {
    tenantId:       'tenant-A',
    agentId:        'agent-1',
    action:         'read_pedido',
    inputSummary:   'Consulta pedido status',
    outcome:        'EXECUTADO',
    latencyMs:      0,
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

describe('AuditService — edge cases', () => {
  it('Edge: latencyMs = 0 is valid (instant response)', async () => {
    const { service } = setup()
    const event = await service.createEvent(makeInput({ latencyMs: 0 }))
    expect(event.latencyMs).toBe(0)
  })

  it('Edge: outcome BLOQUEADO is persisted correctly', async () => {
    const { service } = setup()
    const event = await service.createEvent(makeInput({ outcome: 'BLOQUEADO' }))
    expect(event.outcome).toBe('BLOQUEADO')
  })

  it('Edge: outcome AGUARDANDO is persisted correctly', async () => {
    const { service } = setup()
    const event = await service.createEvent(makeInput({ outcome: 'AGUARDANDO' }))
    expect(event.outcome).toBe('AGUARDANDO')
  })

  it('Edge: outcome ESCALADO is persisted correctly', async () => {
    const { service } = setup()
    const event = await service.createEvent(makeInput({ outcome: 'ESCALADO' }))
    expect(event.outcome).toBe('ESCALADO')
  })

  it('Edge: outcome ERRO is persisted correctly', async () => {
    const { service } = setup()
    const event = await service.createEvent(makeInput({ outcome: 'ERRO' }))
    expect(event.outcome).toBe('ERRO')
  })

  it('Edge: multiple dataCategories are all preserved', async () => {
    const { service } = setup()
    const cats = ['identificacao', 'financeiro', 'saude']
    const event = await service.createEvent(makeInput({ dataCategories: cats }))
    expect(event.dataCategories).toEqual(cats)
  })

  it('Edge: long inputSummary (clean) is accepted up to reasonable size', async () => {
    const { service } = setup()
    const long = 'Agente consultou status de pedido '.repeat(20).trim()
    const event = await service.createEvent(makeInput({ inputSummary: long }))
    expect(event.inputSummary).toBe(long)
  })

  it('Edge: same tenant, two agents — chains are independent (different GENESIS)', async () => {
    const { service, verifier } = setup()
    await service.createEvent(makeInput({ agentId: 'agent-1' }))
    await service.createEvent(makeInput({ agentId: 'agent-1' }))
    await service.createEvent(makeInput({ agentId: 'agent-2' }))

    const r1 = await verifier.verify('tenant-A', 'agent-1')
    const r2 = await verifier.verify('tenant-A', 'agent-2')

    expect(r1.valid).toBe(true)
    expect(r1.totalEvents).toBe(2)
    expect(r2.valid).toBe(true)
    expect(r2.totalEvents).toBe(1)
  })

  it('Edge: two tenants with same agentId — chains are isolated', async () => {
    const { service, verifier } = setup()
    await service.createEvent(makeInput({ tenantId: 'tenant-A', agentId: 'shared-agent' }))
    await service.createEvent(makeInput({ tenantId: 'tenant-B', agentId: 'shared-agent' }))

    const rA = await verifier.verify('tenant-A', 'shared-agent')
    const rB = await verifier.verify('tenant-B', 'shared-agent')

    expect(rA.valid).toBe(true)
    expect(rA.totalEvents).toBe(1)
    expect(rB.valid).toBe(true)
    expect(rB.totalEvents).toBe(1)
  })

  it('Edge: chain of 10 sequential events remains intact and verifiable', async () => {
    const { service, verifier } = setup()
    for (let i = 0; i < 10; i++) {
      await service.createEvent(makeInput({ action: `action_${i}` }))
    }
    const result = await verifier.verify('tenant-A', 'agent-1')
    expect(result.valid).toBe(true)
    expect(result.totalEvents).toBe(10)
  })

  it('Edge: approverId and escalationReason are optional and preserved when provided', async () => {
    const { service } = setup()
    const event = await service.createEvent(makeInput({
      approverId:       'approver-001',
      escalationReason: 'Ação acima do threshold de autonomia',
    }))
    expect(event.approverId).toBe('approver-001')
    expect(event.escalationReason).toBe('Ação acima do threshold de autonomia')
  })

  it('Edge: first event prevHash is always GENESIS, never null or undefined', async () => {
    const { service } = setup()
    const event = await service.createEvent(makeInput())
    expect(event.prevHash).toBe(GENESIS_PREV_HASH)
    expect(event.prevHash).not.toBeNull()
    expect(event.prevHash).not.toBeUndefined()
  })

  it('Edge: validation runs before PII check — empty required field throws before PII scan', async () => {
    const { service } = setup()
    // tenantId vazio deve rejeitar antes de checar PII no inputSummary
    await expect(
      service.createEvent(makeInput({ tenantId: '', inputSummary: 'user@test.com' }))
    ).rejects.toBeInstanceOf(InvalidAuditInputError)
  })
})
