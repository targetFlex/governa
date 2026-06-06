// ============================================================
// read-protheus-pedido.connector.ts
//
// Conector que busca pedidos de venda no Protheus via GET /PEDIDO/.
// Valida a resposta com Zod e mapeia para PedidoInterno.
//
// Upstream: TOTVS Protheus REST — endpoint /PEDIDO/
// Downstream: governa-core (consome PedidoInterno[])
//
// Dicionário de erros: connectors/shared/upstream-error.handler.ts
// Schema:              connectors/pedido/pedido.schema.ts
// Mapper:              connectors/pedido/pedido.mapper.ts
// ============================================================

import { AxiosInstance } from 'axios'
import { ProtheusPedidoSchema, PedidoInterno } from './pedido.schema'
import { PedidoMapper } from './pedido.mapper'
import { handleUpstreamError } from '../shared/upstream-error.handler'

// ── Parâmetros de busca ──────────────────────────────────────

export interface ReadPedidoParams {
  numeroPedido?: string   // C5_NUM
  clienteId?:    string   // C5_CLIENTE
  dataInicio?:   string   // C5_EMISSAO_INI — YYYYMMDD
  dataFim?:      string   // C5_EMISSAO_FIM — YYYYMMDD
}

// ── Conector ─────────────────────────────────────────────────

export class ReadProtheusPedidoConnector {
  constructor(
    private readonly http:   AxiosInstance,
    private readonly mapper: PedidoMapper,
  ) {}

  /**
   * Executa a busca de pedidos no Protheus.
   *
   * @param params - Filtros opcionais de busca
   * @returns Lista de PedidoInterno (pode ser vazia)
   * @throws UpstreamError — falha HTTP mapeada pelo dicionário
   * @throws ZodError     — resposta do Protheus não bate com o schema
   */
  async execute(params: ReadPedidoParams): Promise<PedidoInterno[]> {
    let rawData: unknown

    try {
      const res = await this.http.get('/PEDIDO/', {
        params: this.buildQuery(params),
      })
      rawData = res.data
    } catch (error) {
      throw handleUpstreamError(error, 'read_protheus_pedido')
    }

    // Validar e mapear — ZodError propaga se schema inválido
    const rawList = this.extractList(rawData)
    const validated = rawList.map((item) => ProtheusPedidoSchema.parse(item))
    return validated.map((raw) => this.mapper.toInterno(raw))
  }

  // ── Helpers privados ────────────────────────────────────────

  /**
   * Monta query string a partir dos parâmetros fornecidos.
   * Campos ausentes são omitidos (não enviados ao Protheus).
   */
  private buildQuery(params: ReadPedidoParams): Record<string, string> {
    const q: Record<string, string> = {}
    if (params.numeroPedido) q['C5_NUM']          = params.numeroPedido
    if (params.clienteId)    q['C5_CLIENTE']       = params.clienteId
    if (params.dataInicio)   q['C5_EMISSAO_INI']   = params.dataInicio
    if (params.dataFim)      q['C5_EMISSAO_FIM']   = params.dataFim
    return q
  }

  /**
   * Extrai lista de itens da resposta do Protheus.
   * Suporta dois formatos:
   *   - Array direto: [{ C5_NUM: ... }, ...]
   *   - Envelope:     { items: [{ C5_NUM: ... }, ...] }
   */
  private extractList(data: unknown): unknown[] {
    if (Array.isArray(data)) return data
    const envelope = data as Record<string, unknown>
    if (Array.isArray(envelope?.items)) return envelope.items
    return []
  }
}
