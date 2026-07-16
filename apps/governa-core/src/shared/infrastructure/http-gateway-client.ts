/**
 * HttpGatewayClient — adaptador HTTP que implementa IGatewayClient.
 *
 * Chama governa-gateway via REST:
 *   GET {baseUrl}/pedidos?numeroPedido=...&clienteId=...&dataInicio=...&dataFim=...
 *   GET {baseUrl}/clientes?clienteId=...&documentoToken=...
 *
 * Contrato de erro (herdado de IGatewayClient):
 *   - Lança GatewayUnavailableError em falha de rede ou resposta não-2xx
 *   - Retorna [] se o gateway devolver array vazio (nunca null)
 *
 * Usa fetch nativo (Node 18+) — sem dependência de axios ou node-fetch.
 */
import type {
  IGatewayClient,
  ConsultarPedidosParams,
  ConsultarClientesParams,
} from '../ports/gateway-client.port'
import type { PedidoInterno, ItemPedido, StatusPedido } from '../../modules/pedidos/domain/pedido.entity'
import type { ClienteInterno } from '../../modules/clientes/domain/cliente.entity'
import { GatewayUnavailableError } from '../../modules/pedidos/domain/pedido.errors'

// ─── Raw shapes do payload JSON retornado pelo governa-gateway ────────────────

interface RawItemPedido {
  codigoProduto: string
  quantidade:    number
  precoUnitario: number
}

interface RawPedido {
  numeroPedido:  string
  clienteId:     string
  loja:          string
  dataEmissao:   string   // ISO 8601 — gateway devolve string
  valorTotal:    number
  status:        StatusPedido
  itens:         RawItemPedido[]
}

interface RawCliente {
  codigoCliente:   string
  loja:            string
  nomePseudo:      string
  documentoPseudo: string
  enderecoPseudo:  string
  emailPseudo:     string | null
  telefonePseudo:  string | null
  ativo:           boolean
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapItem(raw: RawItemPedido): ItemPedido {
  return {
    codigoProduto: raw.codigoProduto,
    quantidade:    raw.quantidade,
    precoUnitario: raw.precoUnitario,
  }
}

function mapPedido(raw: RawPedido): PedidoInterno {
  return {
    numeroPedido:  raw.numeroPedido,
    clienteId:     raw.clienteId,
    loja:          raw.loja,
    dataEmissao:   new Date(raw.dataEmissao),
    valorTotal:    raw.valorTotal,
    status:        raw.status,
    itens:         raw.itens.map(mapItem),
  }
}

function mapCliente(raw: RawCliente): ClienteInterno {
  return {
    clienteId:      raw.codigoCliente,
    loja:           raw.loja,
    nomeToken:      raw.nomePseudo,
    documentoToken: raw.documentoPseudo,
    enderecoToken:  raw.enderecoPseudo,
    emailToken:     raw.emailPseudo,
    telefoneToken:  raw.telefonePseudo,
    bloqueado:      !raw.ativo,
  }
}

// ─── Adaptador ────────────────────────────────────────────────────────────────

export class HttpGatewayClient implements IGatewayClient {
  constructor(private readonly baseUrl: string) {}

  async consultarPedidos(params: ConsultarPedidosParams): Promise<PedidoInterno[]> {
    const url  = this.buildUrl('/pedidos', params as Record<string, string | undefined>)
    const { data } = await this.get<{ data: RawPedido[] }>(url)
    return data.map(mapPedido)
  }

  async consultarClientes(params: ConsultarClientesParams): Promise<ClienteInterno[]> {
    // O gateway expõe o filtro de identidade como `codigoCliente` (contrato Pact CC3/CC4) —
    // remapeado aqui porque o nome do parâmetro na porta (`clienteId`) é o vocabulário do core.
    const gatewayParams: Record<string, string | undefined> = {
      codigoCliente:  params.clienteId,
      documentoToken: params.documentoToken,
    }
    const url = this.buildUrl('/clientes', gatewayParams)
    const { data } = await this.get<{ data: RawCliente[] }>(url)
    return data.map(mapCliente)
  }

  // ─── Helpers privados ──────────────────────────────────────────────────────

  private buildUrl(path: string, params: Record<string, string | undefined>): string {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) qs.set(key, value)
    }
    const query = qs.toString()
    return `${this.baseUrl}${path}${query ? `?${query}` : ''}`
  }

  private async get<T>(url: string): Promise<T> {
    let res: Response
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } })
    } catch {
      throw new GatewayUnavailableError(this.baseUrl)
    }

    // 404 do gateway é "nenhum resultado" (contrato NOT_FOUND), não indisponibilidade.
    // A regra de "busca específica sem resultado → erro" é decidida no use case.
    if (res.status === 404) {
      return { data: [] } as T
    }

    if (!res.ok) {
      throw new GatewayUnavailableError(`${this.baseUrl} → HTTP ${res.status}`)
    }

    return res.json() as Promise<T>
  }
}
