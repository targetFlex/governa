import { z } from 'zod'

/**
 * Schemas Zod para validação de input nos endpoints REST.
 * Exportados como schema + tipo inferido — usados no router e em testes.
 */

/**
 * Referência a um conector MCP (E8 — metadado descritivo nesta fase).
 * `icon` é opcional (slug/chave de ícone usado pelo frontend).
 */
export const McpServerRefSchema = z.object({
  id:   z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  icon: z.string().max(120).optional(),
})

export type McpServerRefBody = z.infer<typeof McpServerRefSchema>

// Limites dos campos estendidos — alinhados com a spec (seção 5).
const SYSTEM_PROMPT_MAX = 4000
const MCP_SERVERS_MAX   = 20
const SKILLS_MAX        = 20

export const CreateAgentSchema = z.object({
  name:         z.string().min(1, 'name é obrigatório').max(120),
  description:  z.string().max(500).default(''),
  ownerId:      z.string().uuid('ownerId deve ser UUID'),
  policyId:     z.string().uuid('policyId deve ser UUID').nullable().default(null),
  modelId:      z.string().min(1, 'modelId é obrigatório').max(120),
  tools:        z.array(z.string().min(1)).default([]),
  systemPrompt: z.string().max(SYSTEM_PROMPT_MAX, `systemPrompt excede ${SYSTEM_PROMPT_MAX} caracteres`).optional(),
  mcpServers:   z.array(McpServerRefSchema).max(MCP_SERVERS_MAX, `máximo de ${MCP_SERVERS_MAX} conectores MCP`).optional(),
  skills:       z.array(z.string().min(1)).max(SKILLS_MAX, `máximo de ${SKILLS_MAX} skills`).optional(),
  templateId:   z.string().min(1).max(120).optional(),
})

export type CreateAgentBody = z.infer<typeof CreateAgentSchema>

// UpdateAgentSchema NÃO recebe os campos estendidos (E8) nesta fase:
// a jornada de templates/preview atua apenas na criação (POST /agents).
// PATCH permanece com o contrato original para não introduzir campos que
// o repositório de update ainda não persiste (evita no-op silencioso).
export const UpdateAgentSchema = z.object({
  name:        z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  policyId:    z.string().uuid('policyId deve ser UUID').nullable().optional(),
  modelId:     z.string().min(1).max(120).optional(),
  tools:       z.array(z.string().min(1)).optional(),
}).strict()

export type UpdateAgentBody = z.infer<typeof UpdateAgentSchema>
