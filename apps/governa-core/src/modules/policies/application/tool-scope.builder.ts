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
  /**
   * Tools MCP do agente para esta chamada (D33, sessão 2.77) — catálogo
   * dinâmico, resolvido por chamada a partir dos conectores MCP configurados
   * para o agente, ao contrário de `catalog` (nativo, fixo, injetado no
   * construtor). Mesclado com `catalog` antes da filtragem por autonomia.
   * Wiring real a partir do `McpClientAdapter` fica para a sessão 2.78.
   */
  readonly mcpCatalog?:    readonly Tool[]
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
 *
 * Catálogo MCP (sessão 2.77): `mcpCatalog` em `BuildScopeParams` é mesclado
 * com o catálogo nativo apenas para a chamada corrente — tools MCP não
 * ficam gravadas na instância do builder, porque variam por agente/conector
 * e a instância é compartilhada (injetada uma vez em `server.ts`).
 */
export class ToolScopeBuilder {
  constructor(private readonly catalog: readonly Tool[]) {}

  build(params: BuildScopeParams): ToolScope {
    const fullCatalog = params.mcpCatalog
      ? [...this.catalog, ...params.mcpCatalog]
      : this.catalog
    const tools = this.filterTools(fullCatalog, params.autonomyLevel, params.allowedActions)

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
    catalog: readonly Tool[],
    level: AutonomyLevel,
    allowedActions: readonly string[],
  ): Tool[] {
    if (level === 'CONSULTIVO') {
      return catalog.filter(t => !t.isWrite)
    }

    // ASSISTIDO / AUTONOMO — match por nome exato ou prefixo
    return catalog.filter(t =>
      allowedActions.some(action =>
        t.name === action || t.name.startsWith(action),
      ),
    )
  }
}
