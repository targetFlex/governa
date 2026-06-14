/**
 * Erros de domínio do módulo de inventário de agentes.
 * `code` estável para mapeamento HTTP — dicionário de erros como contrato.
 *
 * Mapeamento HTTP:
 *   AgentNotFoundError       → 404 (nunca 403 — não vazar existência cross-tenant)
 *   AgentNoPolicyError       → 422
 *   AgentDeprecatedError     → 422
 *   AgentInvalidStatusError  → 422
 */

export class AgentNotFoundError extends Error {
  readonly code = 'AGENT_NOT_FOUND'

  constructor(id: string) {
    super(`Agent not found: ${id}`)
    this.name = 'AgentNotFoundError'
  }
}

export class AgentNoPolicyError extends Error {
  readonly code = 'AGENT_NO_POLICY'

  constructor(id: string) {
    super(`Agent ${id} cannot be activated: no policy assigned`)
    this.name = 'AgentNoPolicyError'
  }
}

export class AgentDeprecatedError extends Error {
  readonly code = 'AGENT_DEPRECATED'

  constructor(id: string) {
    super(`Agent ${id} is deprecated and cannot be reactivated`)
    this.name = 'AgentDeprecatedError'
  }
}

export class AgentInvalidStatusTransitionError extends Error {
  readonly code = 'AGENT_INVALID_STATUS_TRANSITION'

  constructor(id: string, from: string, to: string) {
    super(`Agent ${id}: invalid status transition ${from} → ${to}`)
    this.name = 'AgentInvalidStatusTransitionError'
  }
}
