import type { IGatewayClient, ConsultarPedidosParams } from '../../../shared/ports/gateway-client.port'
import type { AuditService } from '../../audit/application/audit.service'
import type { PedidoInterno } from '../domain/pedido.entity'
import type { Outcome } from '../../audit/domain/outcome'
import { PedidoNotFoundError, GatewayUnavailableError } from '../domain/pedido.errors'

export interface ConsultarPedidoPaginacao {
  readonly page:     number
  readonly pageSize: number
}

export interface ConsultarPedidoInput {
  readonly tenantId:      string
  readonly agentId:       string
  readonly subjectToken:  string   // HMAC do sujeito (LGPD)
  readonly filtros:       ConsultarPedidosParams
  readonly spanId?:       string
  /** Busca livre do painel (uso humano) — aplicada em memória. */
  readonly q?:            string
  /** Paginação do painel — omitido preserva o comportamento antigo (lista completa). */
  readonly paginacao?:    ConsultarPedidoPaginacao
}

export interface ConsultarPedidoOutput {
  readonly pedidos:   PedidoInterno[]
  readonly total:     number
  readonly traceId:   string
  readonly latencyMs: number
}

/**
 * ConsultarPedidoUseCase — caso de uso de consulta de pedidos.
 *
 * Orquestra:
 *   1. Busca pedidos via IGatewayClient (porta — sem dep de HTTP)
 *   2. Grava AuditEvent (ferramenta, outcome, latência, LGPD)
 *   3. Retorna pedidos ao chamador
 *
 * Regras de negócio:
 *   - Busca sem resultado → lança PedidoNotFoundError se numeroPedido foi
 *     informado (busca específica). Lista vazia sem filtro → [] sem erro.
 *   - Gateway indisponível → re-lança GatewayUnavailableError APÓS gravar
 *     audit event com outcome 'FAILURE' (rastreabilidade LGPD).
 *
 * Hexagonal: depende SÓ de IGatewayClient (porta) e AuditService.
 * Sem dep de Axios, Express ou Prisma.
 */
export class ConsultarPedidoUseCase {
  constructor(
    private readonly gatewayClient: IGatewayClient,
    private readonly auditService:  AuditService,
  ) {}

  async execute(input: ConsultarPedidoInput): Promise<ConsultarPedidoOutput> {
    const startMs = Date.now()

    let pedidos: PedidoInterno[]
    let outcome: Outcome = 'EXECUTADO'
    let gatewayError: GatewayUnavailableError | undefined

    try {
      pedidos = await this.gatewayClient.consultarPedidos(input.filtros)
    } catch (err) {
      outcome      = 'ERRO'
      gatewayError = err instanceof GatewayUnavailableError
        ? err
        : new GatewayUnavailableError(String(err))
      pedidos      = []
    }

    const latencyMs = Date.now() - startMs

    // Grava audit SEMPRE — sucesso ou falha (rastreabilidade LGPD)
    const auditEvent = await this.auditService.createEvent({
      tenantId:       input.tenantId,
      agentId:        input.agentId,
      action:         'consultar_pedidos',
      toolCalled:     'read_protheus_pedido',
      inputSummary:   this.buildSummary(input.filtros),
      outcome,
      latencyMs,
      subjectToken:   input.subjectToken,
      dataCategories: ['identificacao', 'financeiro'],
      legalBasis:     'execucao_contrato',
      purpose:        'consulta_pedido_atendimento',
      spanId:         input.spanId,
    })

    // Re-lança após audit gravado
    if (gatewayError) throw gatewayError

    // Busca específica por número → exige resultado
    if (input.filtros.numeroPedido && pedidos.length === 0) {
      throw new PedidoNotFoundError(input.filtros.numeroPedido)
    }

    const filtrados = this.applySearch(pedidos, input.q)
    const total      = filtrados.length
    const paginados  = this.applyPagination(filtrados, input.paginacao)

    return {
      pedidos:   paginados,
      total,
      traceId:   auditEvent.traceId,
      latencyMs,
    }
  }

  /** Busca livre do painel — em memória, sobre numeroPedido/clienteId/status. */
  private applySearch(pedidos: PedidoInterno[], q: string | undefined): PedidoInterno[] {
    if (!q?.trim()) return pedidos
    const needle = q.trim().toLowerCase()
    return pedidos.filter(
      (p) =>
        p.numeroPedido.toLowerCase().includes(needle) ||
        p.clienteId.toLowerCase().includes(needle) ||
        p.status.toLowerCase().includes(needle),
    )
  }

  private applyPagination(
    pedidos: PedidoInterno[],
    paginacao: ConsultarPedidoPaginacao | undefined,
  ): PedidoInterno[] {
    if (!paginacao) return pedidos
    const start = (paginacao.page - 1) * paginacao.pageSize
    return pedidos.slice(start, start + paginacao.pageSize)
  }

  private buildSummary(filtros: ConsultarPedidosParams): string {
    const parts: string[] = []
    if (filtros.numeroPedido) parts.push(`num=${filtros.numeroPedido}`)
    if (filtros.clienteId)    parts.push(`cli=${filtros.clienteId}`)
    if (filtros.dataInicio)   parts.push(`ini=${filtros.dataInicio}`)
    if (filtros.dataFim)      parts.push(`fim=${filtros.dataFim}`)
    return parts.length > 0 ? `consultar_pedidos[${parts.join(',')}]` : 'consultar_pedidos[sem-filtro]'
  }
}
