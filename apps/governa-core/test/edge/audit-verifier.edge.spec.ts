import { InMemoryAuditEventRepository } from '../fixtures/in-memory-audit-event.repository'
import { AuditService }                 from '../../src/modules/audit/application/audit.service'
import { AuditVerifier }                from '../../src/modules/audit/application/audit.verifier'
import { GENESIS_PREV_HASH }            from '../../src/modules/audit/application/hash-chain'

/**
 * Edge cases — AuditVerifier
 *
 * Isolados em test/edge/ conforme preferência #5.
 * Focam em cenários de adulteração, corrupção e isolamento de cadeia.
 *
 * Estratégia: usa AuditService para criar eventos legítimos, depois adultera
 * via repo.clear() + repo.seed() — garante que hashes base são reais e o
 * verifier os aceita antes do ponto de adulteração.
 */

const TENANT = 'tenant-A'
const AGENT  = 'agent-1'

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId:       TENANT,
    agentId:        AGENT,
    action:         'read',
    inputSummary:   'consulta padrao',
    outcome:        'EXECUTADO' as const,
    latencyMs:      10,
    subjectToken:   'a'.repeat(64),
    dataCategories: ['identificacao'],
    legalBasis:     'execucao_contrato',
    purpose:        'consulta',
    ...overrides,
  }
}

function setup() {
  const repo     = new InMemoryAuditEventRepository()
  const service  = new AuditService(repo)
  const verifier = new AuditVerifier(repo)
  return { repo, service, verifier }
}

describe('AuditVerifier — edge cases', () => {
  it('Edge: single-event chain is always valid (prevHash = GENESIS)', async () => {
    const { service, verifier } = setup()
    await service.createEvent(makeInput())
    const result = await verifier.verify(TENANT, AGENT)
    expect(result.valid).toBe(true)
    expect(result.totalEvents).toBe(1)
  })

  it('Edge: first event with tampered prevHash breaks at index 0', async () => {
    const { repo, service, verifier } = setup()
    const e0 = await service.createEvent(makeInput())

    // Adultera prevHash do primeiro evento
    repo.clear()
    repo.seed({ ...e0, prevHash: 'bad'.padEnd(64, '0') })

    const result = await verifier.verify(TENANT, AGENT)
    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(0)
    expect(result.reason).toMatch(/prevHash mismatch/)
  })

  it('Edge: tampered inputSummary on middle event causes hash mismatch at index 1', async () => {
    const { repo, service, verifier } = setup()

    await service.createEvent(makeInput({ action: 'a1', inputSummary: 'consulta original' }))
    const e1 = await service.createEvent(makeInput({ action: 'a2', inputSummary: 'consulta original 2' }))
    await service.createEvent(makeInput({ action: 'a3', inputSummary: 'consulta original 3' }))

    const all = repo.all()
    repo.clear()
    repo.seed(all[0])
    repo.seed({ ...e1, inputSummary: 'conteudo adulterado' }) // hash gravado ≠ recomputado
    repo.seed(all[2])

    const result = await verifier.verify(TENANT, AGENT)
    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(1)
    expect(result.reason).toMatch(/hash mismatch/)
  })

  it('Edge: tampered subjectToken causes hash mismatch (LGPD pseudonimização protegida)', async () => {
    const { repo, service, verifier } = setup()
    const e0 = await service.createEvent(makeInput())

    repo.clear()
    repo.seed({ ...e0, subjectToken: 'b'.repeat(64) })

    const result = await verifier.verify(TENANT, AGENT)
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/hash mismatch/)
  })

  it('Edge: tampered latencyMs causes hash mismatch', async () => {
    const { repo, service, verifier } = setup()
    const e0 = await service.createEvent(makeInput({ latencyMs: 100 }))

    repo.clear()
    repo.seed({ ...e0, latencyMs: 0 })

    const result = await verifier.verify(TENANT, AGENT)
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/hash mismatch/)
  })

  it('Edge: valid=false includes totalEvents count up to brokenAt + 1', async () => {
    const { repo, service, verifier } = setup()

    const e0 = await service.createEvent(makeInput())
    const e1 = await service.createEvent(makeInput())

    // Adultera prevHash de e1 — verifier falha em index 1
    repo.clear()
    repo.seed(e0)
    repo.seed({ ...e1, prevHash: 'wrong'.padEnd(64, '0') })

    const result = await verifier.verify(TENANT, AGENT)
    expect(result.valid).toBe(false)
    expect(result.totalEvents).toBe(2)
    expect(result.brokenAt).toBe(1)
  })

  it('Edge: verify for non-existent agentId returns valid with 0 events', async () => {
    const { verifier } = setup()
    const result = await verifier.verify('tenant-ghost', 'agent-ghost')
    expect(result.valid).toBe(true)
    expect(result.totalEvents).toBe(0)
  })

  it('Edge: first event prevHash is GENESIS, never null or undefined', async () => {
    const { service } = setup()
    const e = await service.createEvent(makeInput())
    expect(e.prevHash).toBe(GENESIS_PREV_HASH)
    expect(e.prevHash).not.toBeNull()
    expect(e.prevHash).not.toBeUndefined()
  })

  it('Edge: tampered action causes hash mismatch', async () => {
    const { repo, service, verifier } = setup()
    const e0 = await service.createEvent(makeInput({ action: 'read_original' }))

    repo.clear()
    repo.seed({ ...e0, action: 'write_adulterado' })

    const result = await verifier.verify(TENANT, AGENT)
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/hash mismatch/)
  })

  it('Edge: removing an event from the middle of the chain breaks prevHash link', async () => {
    const { repo, service, verifier } = setup()

    await service.createEvent(makeInput({ action: 'a1' }))
    await service.createEvent(makeInput({ action: 'a2' })) // este será removido
    await service.createEvent(makeInput({ action: 'a3' }))

    const all = repo.all()
    repo.clear()
    // Semente apenas e0 e e2 — e2.prevHash aponta para e1 (removido)
    repo.seed(all[0])
    repo.seed(all[2]) // e2.prevHash ≠ e0.hash → prevHash mismatch em index 1

    const result = await verifier.verify(TENANT, AGENT)
    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(1)
  })
})
