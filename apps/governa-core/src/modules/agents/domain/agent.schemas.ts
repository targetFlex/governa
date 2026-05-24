import { z } from 'zod'

/**
 * Schemas Zod para validação de input nos endpoints REST.
 * Exportados como schema + tipo inferido — usados no router e em testes.
 */

export const CreateAgentSchema = z.object({
  name:        z.string().min(1, 'name é obrigatório').max(120),
  description: z.string().max(500).default(''),
  ownerId:     z.string().uuid('ownerId deve ser UUID'),
  policyId:    z.string().uuid('policyId deve ser UUID').nullable().default(null),
  modelId:     z.string().min(1, 'modelId é obrigatório').max(120),
  tools:       z.array(z.string().min(1)).default([]),
})

export type CreateAgentBody = z.infer<typeof CreateAgentSchema>

export const UpdateAgentSchema = z.object({
  name:        z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  policyId:    z.string().uuid('policyId deve ser UUID').nullable().optional(),
  modelId:     z.string().min(1).max(120).optional(),
  tools:       z.array(z.string().min(1)).optional(),
}).strict()

export type UpdateAgentBody = z.infer<typeof UpdateAgentSchema>
