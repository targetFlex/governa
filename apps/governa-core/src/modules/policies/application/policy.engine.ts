import type { AgentRepository }              from '../domain/agent-repository.port'
import type { ToolScope }                     from '../domain/tool-scope.types'
import type { Tool }                          from '../domain/tool.types'
import {
  AgentNotFoundError,
  AgentWithoutPolicyError,
  ToolBlockedError,
} from './policy.errors'
import { ToolScopeBuilder }                   from './tool-scope.builder'
import type { PolicyViolationAlertService }   from '../../alerts/application/policy-violation-alert.service'

/**
 * PolicyEngine — caso de uso central de governança.
 *
 * Dado (agentId, tenantId), carrega o agente via porta AgentRepository
 * e devolve o ToolScope montado pelo ToolScopeBuilder. Não conhece
 * Prisma, HTTP, JWT ou qualquer detalhe de infra (hexagonal).
 *
 * Garantias:
 *   - tenantId SEMPRE viaja para a porta (isolamento multi-tenant)
 *   - agente DEPRECATED → AgentNotFoundError (repository filtra)
 *   - agente sem policy → AgentWithoutPolicyError (erro descritivo)
 *   - retorno congelado (ToolScopeBuilder retorna objeto frozen)
 */
export class PolicyEngine {
  constructor(
    private readonly agents:                   AgentRepository,
    private readonly scopeBuilder:             ToolScopeBuilder,
    private readonly policyViolationAlertSvc?: PolicyViolationAlertService,
  ) {}

  /**
   * @param mcpCatalog Tools MCP resolvidas para esta chamada pelo caller
   *                   (D34, sessão 2.81 — `AnchorAgentService` resolve os
   *                   conectores do agente via `McpClientAdapter` antes de
   *                   chamar `buildScope`; `PolicyEngine` não conhece MCP
   *                   nem repositório de inventário, só repassa o catálogo
   *                   já resolvido para o `ToolScopeBuilder`).
   */
  async buildScope(agentId: string, tenantId: string, mcpCatalog?: readonly Tool[]): Promise<ToolScope> {
    const agent = await this.agents.findActiveForTenant(agentId, tenantId)

    if (!agent) {
      throw new AgentNotFoundError(agentId, tenantId)
    }

    if (!agent.policy) {
      throw new AgentWithoutPolicyError(agent.id)
    }

    return this.scopeBuilder.build({
      agentId:        agent.id,
      tenantId:       agent.tenantId,
      autonomyLevel:  agent.policy.autonomyLevel,
      allowedActions: agent.policy.allowedActions,
      policyId:       agent.policy.id,
      policyVersion:  agent.policy.version,
      mcpCatalog,
    })
  }

  /**
   * E5.3 — Verifica se uma tool está no escopo de uma política.
   *
   * Se a tool NÃO estiver no escopo:
   *   1. Dispara PolicyViolationAlertService.evaluate() (TOOL_BLOCKED) — best-effort
   *   2. Lança ToolBlockedError para interromper o fluxo do orquestrador
   *
   * Se estiver no escopo: retorna sem efeitos.
   *
   * @param scope    ToolScope já construído via buildScope()
   * @param toolName nome exato da tool solicitada pelo agente
   */
  async assertToolAllowed(scope: ToolScope, toolName: string): Promise<void> {
    const allowed = scope.tools.some((t) => t.name === toolName)
    if (allowed) return

    const reason = `tool '${toolName}' não está no escopo da política (autonomyLevel: ${scope.autonomyLevel})`

    // disparo best-effort — não bloqueia o throw abaixo
    void this.policyViolationAlertSvc?.evaluate({
      kind:      'TOOL_BLOCKED',
      tenantId:  scope.tenantId,
      agentId:   scope.agentId,
      toolName,
      policyId:  scope.policyId,
      reason,
      timestamp: new Date(),
    }).catch((err: unknown) => {
      console.error('[PolicyEngine] policyViolationAlertSvc.evaluate falhou', err)
    })

    throw new ToolBlockedError(toolName, scope.policyId, reason)
  }
}
