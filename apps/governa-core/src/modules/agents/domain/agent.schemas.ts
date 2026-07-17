import { z } from 'zod'

/**
 * Schemas Zod para validação de input nos endpoints REST.
 * Exportados como schema + tipo inferido — usados no router e em testes.
 */

/**
 * Referência a um conector MCP.
 * `icon` é opcional (slug/chave de ícone usado pelo frontend).
 * `url` habilita conexão real via MCP remoto (Streamable HTTP) — sem stdio,
 * por risco de RCE num backend multi-tenant. Sem `url`, o conector continua
 * sendo apenas metadado descritivo (comportamento anterior, preservado).
 * `headers` carrega credenciais (ex.: Bearer token) em texto simples, no
 * mesmo nível de proteção do restante da tabela — débito de segurança a
 * resolver (cofre de secrets dedicado) antes de conectar servidores MCP de
 * terceiros reais em produção.
 */
export const McpServerRefSchema = z.object({
  id:      z.string().min(1).max(120),
  name:    z.string().min(1).max(120),
  icon:    z.string().max(120).optional(),
  url:     z.string()
             .max(2048)
             .refine(v => /^https?:\/\//i.test(v), 'url deve ser http:// ou https:// (transporte MCP remoto — sem stdio)')
             .optional(),
  headers: z.record(z.string().min(1).max(200), z.string().max(4000))
             .refine(h => Object.keys(h).length <= 20, 'máximo de 20 headers')
             .optional(),
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

// mcpServers liberado no PATCH a partir da Fase 3 (sessão 2.75) — o
// repositório de update passa a persistir o campo (ver
// prisma-agent-inventory.repository.ts). Os demais campos estendidos
// (systemPrompt, skills, templateId) continuam de criação apenas.
export const UpdateAgentSchema = z.object({
  name:        z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  policyId:    z.string().uuid('policyId deve ser UUID').nullable().optional(),
  modelId:     z.string().min(1).max(120).optional(),
  tools:       z.array(z.string().min(1)).optional(),
  mcpServers:  z.array(McpServerRefSchema).max(MCP_SERVERS_MAX, `máximo de ${MCP_SERVERS_MAX} conectores MCP`).optional(),
}).strict()

export type UpdateAgentBody = z.infer<typeof UpdateAgentSchema>
