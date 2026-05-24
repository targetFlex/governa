import { InvalidAuditInputError, AuditChainBrokenError } from './audit.errors'

describe('InvalidAuditInputError', () => {
  it('When created, Then message includes field and reason', () => {
    const err = new InvalidAuditInputError('tenantId', 'obrigatório')
    expect(err.message).toContain('tenantId')
    expect(err.message).toContain('obrigatório')
  })

  it('When created, Then code is INVALID_AUDIT_INPUT', () => {
    const err = new InvalidAuditInputError('agentId', 'obrigatório')
    expect(err.code).toBe('INVALID_AUDIT_INPUT')
  })

  it('When created, Then name is InvalidAuditInputError', () => {
    const err = new InvalidAuditInputError('x', 'y')
    expect(err.name).toBe('InvalidAuditInputError')
  })

  it('When instanceof checked, Then is an Error', () => {
    expect(new InvalidAuditInputError('x', 'y')).toBeInstanceOf(Error)
  })
})

describe('AuditChainBrokenError', () => {
  it('When created, Then message contains tenantId, agentId, index and reason', () => {
    const err = new AuditChainBrokenError('t-1', 'a-1', 3, 'hash mismatch')
    expect(err.message).toContain('t-1')
    expect(err.message).toContain('a-1')
    expect(err.message).toContain('3')
    expect(err.message).toContain('hash mismatch')
  })

  it('When created, Then code is AUDIT_CHAIN_BROKEN', () => {
    const err = new AuditChainBrokenError('t', 'a', 0, 'reason')
    expect(err.code).toBe('AUDIT_CHAIN_BROKEN')
  })

  it('When created, Then name is AuditChainBrokenError', () => {
    const err = new AuditChainBrokenError('t', 'a', 0, 'reason')
    expect(err.name).toBe('AuditChainBrokenError')
  })

  it('When created, Then exposes tenantId, agentId and brokenAt', () => {
    const err = new AuditChainBrokenError('tenant-X', 'agent-Y', 7, 'test')
    expect(err.tenantId).toBe('tenant-X')
    expect(err.agentId).toBe('agent-Y')
    expect(err.brokenAt).toBe(7)
  })
})
