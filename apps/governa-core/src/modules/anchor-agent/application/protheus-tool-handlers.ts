import type { ConsultarPedidoUseCase }  from '../../pedidos/application/consultar-pedido.use-case'
import type { ConsultarClienteUseCase } from '../../clientes/application/consultar-cliente.use-case'
import type { LlmToolDef }              from '../../../shared/ports/llm-client.port'

// ─── Tipo do handler ──────────────────────────────────────────────────────────

export interface ToolHandlerContext {
  readonly tenantId:     string
  readonly agentId:      string
  readonly subjectToken: string
  readonly params:       unknown
}

export type ToolHandler = (ctx: ToolHandlerContext) => Promise<unknown>

// ─── Schemas Anthropic (input_schema de cada tool) ───────────────────────────

export const PROTHEUS_TOOL_DEFS: readonly LlmToolDef[] = Object.freeze([
  {
    name:        'read_protheus_pedido',
    description: 'Consulta pedido(s) no Protheus por filtros. Retorna lista de pedidos do tenant.',
    input_schema: {
      type: 'object',
      properties: {
        numeroPedido: { type: 'string', description: 'Número exato do pedido (opcional)' },
        clienteId:    { type: 'string', description: 'ID do cliente para filtrar pedidos (opcional)' },
        dataInicio:   { type: 'string', description: 'Data início no formato YYYYMMDD (opcional)' },
        dataFim:      { type: 'string', description: 'Data fim no formato YYYYMMDD (opcional)' },
      },
      required: [],
    },
  },
  {
    name:        'read_protheus_cliente',
    description: 'Consulta cadastro de cliente(s) no Protheus. Retorna dados do cliente.',
    input_schema: {
      type: 'object',
      properties: {
        clienteId:      { type: 'string', description: 'ID interno do cliente no Protheus (opcional)' },
        documentoToken: { type: 'string', description: 'Token HMAC do documento fiscal (CPF/CNPJ pseudonimizado) (opcional)' },
      },
      required: [],
    },
  },
])

// ─── Factory de handlers ──────────────────────────────────────────────────────

export function buildProtheusHandlers(
  consultarPedido:  ConsultarPedidoUseCase,
  consultarCliente: ConsultarClienteUseCase,
): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>()

  handlers.set('read_protheus_pedido', async (ctx) => {
    const p = (ctx.params ?? {}) as Record<string, string | undefined>
    return consultarPedido.execute({
      tenantId:     ctx.tenantId,
      agentId:      ctx.agentId,
      subjectToken: ctx.subjectToken,
      filtros: {
        numeroPedido: p['numeroPedido'],
        clienteId:    p['clienteId'],
        dataInicio:   p['dataInicio'],
        dataFim:      p['dataFim'],
      },
    })
  })

  handlers.set('read_protheus_cliente', async (ctx) => {
    const p = (ctx.params ?? {}) as Record<string, string | undefined>
    return consultarCliente.execute({
      tenantId:     ctx.tenantId,
      agentId:      ctx.agentId,
      subjectToken: ctx.subjectToken,
      filtros: {
        clienteId:      p['clienteId'],
        documentoToken: p['documentoToken'],
      },
    })
  })

  return handlers
}
