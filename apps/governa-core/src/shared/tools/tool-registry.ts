import type { Tool } from '../../modules/policies/domain/tool.types'

/**
 * Tool registry — inventário canônico das tools disponíveis no MVP.
 *
 * Sessão 1.2: tools são INERTES — `execute` é stub que lança erro até
 * a sessão 2 (integração Protheus) plugar os handlers reais.
 *
 * O registry é a única fonte de verdade que o ToolScopeBuilder filtra
 * por nível de autonomia + allowedActions da policy. Tool fora deste
 * registry é fisicamente inalcançável para qualquer agente.
 *
 * Convenção de nomes (preferência #1 — contratos versionados):
 *   read_<dominio>_<entidade>   → consulta (isWrite = false)
 *   write_<dominio>_<entidade>  → mutação  (isWrite = true)
 */

const notImplemented = async (): Promise<never> => {
  throw new Error('Tool execution stub — integração Protheus chega na sessão 2')
}

const tool = (
  name: string,
  description: string,
  isWrite: boolean,
): Tool => ({
  name,
  description,
  isWrite,
  source: 'native',
  execute: notImplemented,
})

export const ALL_TOOLS: readonly Tool[] = Object.freeze([
  // ── Reads ── (CONSULTIVO base)
  tool('read_protheus_pedido',         'Consulta pedido(s) no Protheus por filtros', false),
  tool('read_protheus_cliente',        'Consulta cadastro de cliente no Protheus',   false),
  tool('read_politica_atendimento',    'Consulta política de atendimento vigente',   false),
  tool('read_protheus_estoque',        'Consulta saldo de estoque no Protheus',      false),
  tool('read_protheus_titulo_aberto',  'Consulta títulos em aberto (financeiro)',    false),

  // ── Writes ── (ASSISTIDO / AUTONOMO)
  tool('write_protheus_pedido_nota',   'Adiciona nota livre a um pedido Protheus',   true),
  tool('write_protheus_pedido_status', 'Altera status de pedido Protheus',           true),
])

/**
 * Helper para testes — retorna instância isolada do registry.
 * Usado quando um teste precisa adicionar/remover tool sem mutar o global.
 */
export function getAllTools(): readonly Tool[] {
  return ALL_TOOLS
}
