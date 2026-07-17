import type { AgentStatus } from '../../policies/domain/agent.entity'

/**
 * Referência a um conector MCP habilitado no agente.
 *
 * `icon` é opcional (chave/slug de ícone no frontend). `url` habilita conexão
 * real via MCP remoto (Streamable HTTP); sem `url` o conector continua sendo
 * apenas metadado descritivo. `headers` carrega credenciais em texto simples
 * — débito de segurança documentado, ver agent.schemas.ts.
 */
export interface McpServerRef {
  readonly id:      string
  readonly name:    string
  readonly icon?:   string
  readonly url?:    string
  readonly headers?: Readonly<Record<string, string>>
}

/**
 * AgentInventoryEntity — visão completa do agente para o módulo de inventário.
 *
 * Diferente de AgentEntity (usada pelo PolicyEngine — view mínima),
 * esta entidade expõe todos os campos do modelo Prisma para suportar
 * CRUD completo via endpoints REST.
 *
 * Invariante: tenantId sempre presente — nunca retornar agente sem tenant.
 */
export interface AgentInventoryEntity {
  readonly id:           string
  readonly tenantId:     string
  readonly name:         string
  readonly description:  string
  readonly ownerId:      string
  readonly policyId:     string | null
  readonly status:       AgentStatus
  readonly modelId:      string
  readonly tools:        readonly string[]
  /** System prompt livre; null quando não configurado (ex.: template "em branco"). */
  readonly systemPrompt: string | null
  /** Conectores MCP habilitados (metadado descritivo nesta fase). */
  readonly mcpServers:   readonly McpServerRef[]
  /** Módulos de capacidade selecionados. */
  readonly skills:       readonly string[]
  /** Template de origem; null quando criado do zero ("Agente em branco"). */
  readonly templateId:   string | null
  readonly createdAt:    Date
  readonly updatedAt:    Date
  readonly lastActiveAt: Date | null
}

/**
 * Input para criação de agente.
 * status não é informado pelo client — começa sempre em SANDBOX.
 *
 * Campos estendidos (E8) são opcionais no input e recebem default no adapter:
 * systemPrompt → null, mcpServers → [], skills → [], templateId → null.
 */
export interface CreateAgentInput {
  readonly tenantId:     string
  readonly name:         string
  readonly description:  string
  readonly ownerId:      string
  readonly policyId:     string | null
  readonly modelId:      string
  readonly tools:        readonly string[]
  readonly systemPrompt?: string | null
  readonly mcpServers?:   readonly McpServerRef[]
  readonly skills?:       readonly string[]
  readonly templateId?:   string | null
}

/**
 * Input para atualização parcial.
 * tenantId e status NÃO são atualizáveis via PATCH genérico —
 * status muda via /pause e /activate apenas.
 */
export interface UpdateAgentInput {
  readonly name?:        string
  readonly description?: string
  readonly policyId?:    string | null
  readonly modelId?:     string
  readonly tools?:       readonly string[]
  readonly mcpServers?:  readonly McpServerRef[]
}
