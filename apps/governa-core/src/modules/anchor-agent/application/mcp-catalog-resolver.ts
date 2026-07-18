import type { McpServerRef } from '../../agents/domain/agent-inventory.entity'
import type { Tool }         from '../../policies/domain/tool.types'
import type { LlmToolDef }   from '../../../shared/ports/llm-client.port'
import type { ToolHandler }  from './protheus-tool-handlers'
import { McpClientAdapter }  from '../infrastructure/mcp-client-adapter'

export interface McpCatalog {
  readonly toolDefs:    readonly LlmToolDef[]
  readonly policyTools: readonly Tool[]
  readonly handlers:    ReadonlyMap<string, ToolHandler>
}

export const EMPTY_MCP_CATALOG: McpCatalog = Object.freeze({
  toolDefs:    [],
  policyTools: [],
  handlers:    new Map(),
})

// Tool.execute nunca é chamado no fluxo do AnchorAgentService — execução real
// passa por `handlers` (ver tool-registry.ts, mesmo padrão para tools nativas).
const executeNotUsed = async (): Promise<never> => {
  throw new Error('Tool.execute não é usado — execução MCP passa por ToolHandler (mcp-catalog-resolver)')
}

/**
 * Resolve o catálogo MCP de um agente conectando a cada conector configurado
 * (`McpServerRef.url`) via `McpClientAdapter` (D34, sessão 2.81).
 *
 * `isWrite: true` fixo para toda tool MCP, independente de
 * `annotations.readOnlyHint` do protocolo — servidores MCP são fronteira não
 * confiável e a spec do MCP recomenda explicitamente não usar esse hint para
 * decisões de segurança (é o próprio servidor quem declara). Com isso, um
 * agente CONSULTIVO (que só herda tools `!isWrite`) nunca ganha acesso a
 * tools MCP automaticamente; elas só entram em cena quando a policy é
 * ASSISTIDO/AUTONOMO e um humano lista o nome explicitamente em
 * `allowedActions`.
 *
 * Falha de conexão em um servidor é best-effort — não derruba os demais,
 * apenas omite esse conector do catálogo desta chamada.
 */
export async function resolveMcpCatalog(mcpServers: readonly McpServerRef[]): Promise<McpCatalog> {
  const connectable = mcpServers.filter(s => s.url)
  if (connectable.length === 0) return EMPTY_MCP_CATALOG

  const toolDefs:    LlmToolDef[] = []
  const policyTools: Tool[]       = []
  const handlers = new Map<string, ToolHandler>()

  await Promise.all(connectable.map(async (server) => {
    try {
      const adapter = new McpClientAdapter(server)
      const [defs, toolHandlers] = await Promise.all([
        adapter.listTools(),
        adapter.buildToolHandlers(),
      ])

      for (const def of defs) {
        toolDefs.push(def)
        policyTools.push({
          name:        def.name,
          description: def.description,
          isWrite:     true,
          source:      'mcp',
          serverId:    server.id,
          execute:     executeNotUsed,
        })
      }
      for (const [name, handler] of toolHandlers) {
        handlers.set(name, handler)
      }
    } catch (err) {
      console.error(`[resolveMcpCatalog] conector '${server.id}' falhou — omitido do catálogo desta chamada`, err)
    }
  }))

  return { toolDefs, policyTools, handlers }
}
