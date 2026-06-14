import type { AutonomyLevel } from '../domain/autonomy-level'
import type { Tool } from '../domain/tool.types'
import type { ToolScope } from '../domain/tool-scope.types'

export interface BuildScopeParams {
  readonly agentId:        string
  readonly tenantId:       string
  readonly autonomyLevel:  AutonomyLevel
  readonly allowedActions: readonly string[]
  readonly policyId:       string
  readonly policyVersion:  string
}

/**
 * ToolScopeBuilder — lógica de domínio pura.
 *
 * Recebe o catálogo de tools por DI (não importa do registry direto),
 * o que mantém o builder testável e desacoplado da fonte de verdade
 * em tempo de execução. Em produção, a fábrica injeta `ALL_TOOLS`.
 *
 * Regras de filtragem (spec E1, sessão 1.2):
 *   - CONSULTIVO:           todas as tools `!isWrite` do catálogo
 *                           (allowedActions é informacional neste nível)
 *   - ASSISTIDO / AUTONOMO: tools cujo nome === action OU startsWith(action)
 *                           presente em allowedActions
 *
 * Nota de governança: a permissividade de CONSULTIVO (todos os reads) é
 * conforme o spec. Vale revisitar na sessão 1.5 se quisermos endurecer
 * para "interseção entre reads do catálogo e allowedActions".
 */
export class ToolScopeBuilder {
  constructor(private readonly catalog: readonly Tool[]) {}

  build(params: BuildScopeParams): ToolScope {
    const tools = this.filterTools(params.autonomyLevel, params.allowedActions)

    return Object.freeze({
      agentId:       params.agentId,
      tenantId:      params.tenantId,
      autonomyLevel: params.autonomyLevel,
      tools:         Object.freeze(tools),
      policyId:      params.policyId,
      policyVersion: params.policyVersion,
    })
  }

  private filterTools(
    level: AutonomyLevel,
    allowedActions: readonly string[],
  ): Tool[] {
    if (level === 'CONSULTIVO') {
      return this.catalog.filter(t => !t.isWrite)
    }

    // ASSISTIDO / AUTONOMO — match por nome exato ou prefixo
    return this.catalog.filter(t =>
      allowedActions.some(action =>
        t.name === action || t.name.startsWith(action),
      ),
    )
  }
}
