/**
 * Tool — capacidade discreta que um agente pode invocar.
 *
 * `isWrite` é a chave da governança: classifica a tool como leitura (false)
 * ou mutação (true). O ToolScopeBuilder usa isso para aplicar o nível de
 * autonomia. Convenção de nomes:
 *   - read_*   → consultas (isWrite = false)
 *   - write_*  → mutações (isWrite = true)
 *
 * `source`/`serverId` — proveniência (D33, sessão 2.77): distingue tools do
 * registry nativo (`ALL_TOOLS`) das expostas por conectores MCP remotos.
 * `serverId` é obrigatório quando `source === 'mcp'` (identifica qual
 * `McpServerRef` originou a tool — nomes MCP já vêm prefixados
 * `mcp__{serverId}__{toolName}` pelo `McpClientAdapter`) e ausente para
 * tools nativas.
 */
export type ToolSource = 'native' | 'mcp'

export interface Tool {
  readonly name:        string
  readonly description: string
  readonly isWrite:     boolean
  readonly source:      ToolSource
  readonly serverId?:   string
  /**
   * Stub para o MVP — sessão 1.2 não invoca tools de verdade.
   * Sessão 2 (integração Protheus) substitui pelos handlers reais.
   */
  readonly execute:     (params: unknown) => Promise<unknown>
}
