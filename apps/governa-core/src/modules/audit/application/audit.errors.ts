/**
 * Erros de domínio do AuditService / AuditVerifier.
 * Mantêm `code` estável para mapeamento HTTP e dicionário de erros
 * (preferência #1 — contratos versionados).
 */

export class InvalidAuditInputError extends Error {
  readonly code = 'INVALID_AUDIT_INPUT'

  constructor(field: string, reason: string) {
    super(`Invalid audit input — ${field}: ${reason}`)
    this.name = 'InvalidAuditInputError'
  }
}

export class AuditChainBrokenError extends Error {
  readonly code = 'AUDIT_CHAIN_BROKEN'

  constructor(
    readonly tenantId: string,
    readonly agentId:  string,
    readonly brokenAt: number,
    readonly reason:   string,
  ) {
    super(
      `Audit chain broken for tenant=${tenantId} agent=${agentId} ` +
      `at index ${brokenAt}: ${reason}`,
    )
    this.name = 'AuditChainBrokenError'
  }
}
