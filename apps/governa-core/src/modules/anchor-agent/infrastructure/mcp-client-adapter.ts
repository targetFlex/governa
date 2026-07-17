import { Client }                        from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import type { McpServerRef }            from '../../agents/domain/agent-inventory.entity'
import type { LlmToolDef }              from '../../../shared/ports/llm-client.port'
import type { ToolHandler }             from '../application/protheus-tool-handlers'

/**
 * McpClientAdapter — ponte entre um conector MCP remoto (Streamable HTTP) e as
 * portas já usadas pelo `AnchorAgentService` (`LlmToolDef[]` para o catálogo de
 * tools, `ToolHandler` para execução).
 *
 * Só transporte HTTP remoto — sem stdio (spawnar processo a partir de config de
 * agente num backend multi-tenant é superfície de RCE inaceitável). Ver D29 em
 * `docs/reports/2026-07-16-sessao-2.75.md`.
 *
 * Wiring no `AnchorAgentService` fica para a sessão 2.78 — este adapter só expõe
 * `listTools`/`buildToolHandlers`, sem ser chamado em runtime ainda.
 */
export class McpClientAdapter {
  private client: Client | undefined

  constructor(private readonly server: McpServerRef) {
    if (!server.url) {
      throw new Error(`McpClientAdapter: conector '${server.id}' não tem 'url' — não é possível conectar`)
    }
  }

  private async connect(): Promise<Client> {
    if (this.client) return this.client

    const transport = new StreamableHTTPClientTransport(new URL(this.server.url!), {
      requestInit: this.server.headers ? { headers: { ...this.server.headers } } : undefined,
    })
    const client = new Client({ name: 'governa-core', version: '0.1.0' })
    await client.connect(transport)
    this.client = client
    return client
  }

  async close(): Promise<void> {
    await this.client?.close()
    this.client = undefined
  }

  /**
   * `tools/list` do servidor MCP, mapeado para o shape que o `LlmClient`
   * (Anthropic) espera. Nomes são prefixados com `mcp__{serverId}__` para
   * evitar colisão com tools nativas (ex.: `read_protheus_pedido`).
   */
  async listTools(): Promise<LlmToolDef[]> {
    const client = await this.connect()
    const { tools } = await client.listTools()

    return tools.map(tool => ({
      name:        this.prefixedToolName(tool.name),
      description: tool.description ?? '',
      input_schema: {
        type:       'object' as const,
        properties: tool.inputSchema.properties ?? {},
        required:   tool.inputSchema.required ?? [],
      },
    }))
  }

  /**
   * Um `ToolHandler` por tool do servidor, indexado pelo nome prefixado
   * (mesmo nome retornado por `listTools`). `ToolHandlerContext.params` vira
   * `arguments` da chamada `tools/call`.
   */
  async buildToolHandlers(): Promise<Map<string, ToolHandler>> {
    const client  = await this.connect()
    const { tools } = await client.listTools()
    const handlers = new Map<string, ToolHandler>()

    for (const tool of tools) {
      handlers.set(this.prefixedToolName(tool.name), async (ctx) => {
        const result = await client.callTool({
          name:      tool.name,
          arguments: (ctx.params ?? {}) as Record<string, unknown>,
        })

        if (result['isError']) {
          throw new Error(`McpClientAdapter: tool '${tool.name}' (servidor '${this.server.id}') retornou erro: ${JSON.stringify(result['content'])}`)
        }

        return result['content']
      })
    }

    return handlers
  }

  private prefixedToolName(toolName: string): string {
    return `mcp__${this.server.id}__${toolName}`
  }
}
