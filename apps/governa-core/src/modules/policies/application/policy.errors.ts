/**
 * Erros de domínio do PolicyEngine.
 *
 * Estendem Error para retro-compat com o spec original do E1
 * (`throw new Error(...)`) e permitem `instanceof` em handlers HTTP
 * que mapeiam para 404 / 422 sem expor stack pro client.
 */

export class AgentNotFoundError extends Error {
  readonly code = 'AGENT_NOT_FOUND'

  constructor(agentId: string, tenantId: string) {
    super(`Agent ${agentId} not found for tenant ${tenantId}`)
    this.name = 'AgentNotFoundError'
  }
}

export class AgentWithoutPolicyError extends Error {
  readonly code = 'AGENT_WITHOUT_POLICY'

  constructor(agentId: string) {
    super(`Agent ${agentId} has no active policy`)
    this.name = 'AgentWithoutPolicyError'
  }
}

export class ToolBlockedError extends Error {
  readonly code:     'TOOL_BLOCKED' = 'TOOL_BLOCKED'
  readonly toolName: string
  readonly policyId: string
  readonly reason:   string

  constructor(toolName: string, policyId: string, reason: string) {
    super(`Tool '${toolName}' bloqueada pela política ${policyId}: ${reason}`)
    this.name     = 'ToolBlockedError'
    this.toolName = toolName
    this.policyId = policyId
    this.reason   = reason
  }
}
