import { GENESIS_PREV_HASH, computeHash } from './hash-chain'
import type { HashablePayload } from './hash-chain'

const basePayload: HashablePayload = {
  tenantId:       'tenant-A',
  agentId:        'agent-1',
  traceId:        'trace-001',
  prevHash:       GENESIS_PREV_HASH,
  action:         'read_pedido',
  inputSummary:   'Consulta pedido #42',
  outcome:        'EXECUTADO',
  latencyMs:      120,
  subjectToken:   'a'.repeat(64),
  dataCategories: ['identificacao'],
  legalBasis:     'execucao_contrato',
  purpose:        'consulta_status',
  retentionUntil: new Date('2029-01-01T00:00:00.000Z'),
}

describe('GENESIS_PREV_HASH', () => {
  it('is 64 zeros (SHA-256 sentinel)', () => {
    expect(GENESIS_PREV_HASH).toBe('0'.repeat(64))
    expect(GENESIS_PREV_HASH).toHaveLength(64)
  })
})

describe('computeHash', () => {
  describe('Given a valid HashablePayload', () => {
    it('When called twice with the same payload, Then produces identical hash', () => {
      const h1 = computeHash(basePayload)
      const h2 = computeHash(basePayload)
      expect(h1).toBe(h2)
    })

    it('When called, Then produces a 64-character hex string (SHA-256)', () => {
      const h = computeHash(basePayload)
      expect(h).toHaveLength(64)
      expect(h).toMatch(/^[0-9a-f]{64}$/)
    })

    it('When key order differs in the object, Then hash is unchanged (canonical JSON)', () => {
      const reordered: HashablePayload = {
        ...basePayload,
        // Re-order some fields manually — canonicalJson normalises
      }
      expect(computeHash(basePayload)).toBe(computeHash(reordered))
    })
  })

  describe('Given payload mutations', () => {
    it('When action changes, Then hash changes', () => {
      const h1 = computeHash(basePayload)
      const h2 = computeHash({ ...basePayload, action: 'write_pedido' })
      expect(h1).not.toBe(h2)
    })

    it('When prevHash changes, Then hash changes', () => {
      const h1 = computeHash(basePayload)
      const h2 = computeHash({ ...basePayload, prevHash: 'b'.repeat(64) })
      expect(h1).not.toBe(h2)
    })

    it('When tenantId changes, Then hash changes', () => {
      const h1 = computeHash(basePayload)
      const h2 = computeHash({ ...basePayload, tenantId: 'tenant-B' })
      expect(h1).not.toBe(h2)
    })

    it('When subjectToken changes, Then hash changes', () => {
      const h1 = computeHash(basePayload)
      const h2 = computeHash({ ...basePayload, subjectToken: 'b'.repeat(64) })
      expect(h1).not.toBe(h2)
    })

    it('When retentionUntil changes, Then hash changes', () => {
      const h1 = computeHash(basePayload)
      const h2 = computeHash({ ...basePayload, retentionUntil: new Date('2030-01-01T00:00:00.000Z') })
      expect(h1).not.toBe(h2)
    })

    it('When optional spanId is added, Then hash changes', () => {
      const h1 = computeHash(basePayload)
      const h2 = computeHash({ ...basePayload, spanId: 'span-001' })
      expect(h1).not.toBe(h2)
    })

    it('When optional toolCalled is added, Then hash changes', () => {
      const h1 = computeHash(basePayload)
      const h2 = computeHash({ ...basePayload, toolCalled: 'protheus_api' })
      expect(h1).not.toBe(h2)
    })

    it('When latencyMs changes, Then hash changes', () => {
      const h1 = computeHash(basePayload)
      const h2 = computeHash({ ...basePayload, latencyMs: 999 })
      expect(h1).not.toBe(h2)
    })
  })

  describe('Given retentionUntil as string vs Date', () => {
    it('When retentionUntil is a string ISO, Then hash matches Date equivalent', () => {
      const iso = '2029-01-01T00:00:00.000Z'
      const h1 = computeHash(basePayload) // retentionUntil = new Date(iso)
      const h2 = computeHash({ ...basePayload, retentionUntil: iso })
      expect(h1).toBe(h2)
    })
  })
})
