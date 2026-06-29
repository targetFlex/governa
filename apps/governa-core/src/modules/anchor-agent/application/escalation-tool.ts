import type { LlmToolDef }     from '../../../shared/ports/llm-client.port'
import type { EscalationReason } from '../domain/anchor-agent.types'

/**
 * Meta-tool de escalonamento — sempre disponível para Claude,
 * independente do ToolScope de governança.
 *
 * Claude chama esta tool quando detecta qualquer um dos critérios:
 *   - Usuário pediu falar com humano
 *   - Solicitação exige ação além da consulta (escrita/cancelamento)
 *   - Não foi possível resolver com as informações disponíveis
 *   - Situação de conflito grave / tópico sensível
 */
export const ESCALATE_TOOL_NAME = 'escalate_to_human'

export interface EscalateToolInput {
  reason:  EscalationReason
  summary: string
}

export const ESCALATE_TOOL_DEF: LlmToolDef = {
  name:        ESCALATE_TOOL_NAME,
  description: 'Transfere o atendimento para um operador humano. Use quando: (1) o usuário solicitar explicitamente falar com humano ou atendente, (2) a solicitação requer ação que vai além da consulta — como cancelar pedido, alterar dados ou tomar decisões, (3) não foi possível resolver a dúvida com as informações disponíveis, (4) situação de conflito grave ou reclamação que exige julgamento humano.',
  input_schema: {
    type: 'object',
    properties: {
      reason: {
        type:        'string',
        description: 'Motivo do escalonamento',
        enum:        ['USER_REQUESTED', 'SCOPE_EXCEEDED', 'CANNOT_RESOLVE', 'SENSITIVE_TOPIC'],
      },
      summary: {
        type:        'string',
        description: 'Resumo do atendimento para o operador humano receber o contexto completo da conversa',
      },
    },
    required: ['reason', 'summary'],
  },
}
