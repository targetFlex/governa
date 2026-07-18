import type {
  IGatewayClient,
  ConsultarPedidosParams,
  ConsultarClientesParams,
  ReidentificarClienteParams,
  ClientePiiView,
} from '../../src/shared/ports/gateway-client.port'
import type { PedidoInterno } from '../../src/modules/pedidos/domain/pedido.entity'
import type { ClienteInterno } from '../../src/modules/clientes/domain/cliente.entity'
import { GatewayUnavailableError } from '../../src/modules/pedidos/domain/pedido.errors'

/**
 * InMemoryGatewayClient — adapter de teste para IGatewayClient.
 *
 * Permite:
 *   - seed() de pedidos/clientes por chave (numeroPedido, clienteId)
 *   - simulação de falha via simulateUnavailable()
 *   - inspeção de chamadas realizadas via calls
 */
export class InMemoryGatewayClient implements IGatewayClient {
  private pedidosStore: PedidoInterno[]     = []
  private clientesStore: ClienteInterno[]   = []
  private clientesPiiStore: ClientePiiView[] = []
  private unavailable = false

  /** Calls registradas para inspeção nos testes */
  readonly calls: {
    consultarPedidos: ConsultarPedidosParams[]
    consultarClientes: ConsultarClientesParams[]
    reidentificarCliente: ReidentificarClienteParams[]
  } = {
    consultarPedidos:     [],
    consultarClientes:    [],
    reidentificarCliente: [],
  }

  /** Adiciona pedidos ao store */
  seedPedidos(pedidos: PedidoInterno[]): void {
    this.pedidosStore.push(...pedidos)
  }

  /** Adiciona clientes ao store */
  seedClientes(clientes: ClienteInterno[]): void {
    this.clientesStore.push(...clientes)
  }

  /** Adiciona views de reidentificação (PII em claro) ao store */
  seedClientesPii(clientes: ClientePiiView[]): void {
    this.clientesPiiStore.push(...clientes)
  }

  /** Faz o próximo call lançar GatewayUnavailableError */
  simulateUnavailable(value = true): void {
    this.unavailable = value
  }

  /** Limpa todo estado */
  clear(): void {
    this.pedidosStore     = []
    this.clientesStore    = []
    this.clientesPiiStore = []
    this.unavailable      = false
    this.calls.consultarPedidos     = []
    this.calls.consultarClientes    = []
    this.calls.reidentificarCliente = []
  }

  async consultarPedidos(params: ConsultarPedidosParams): Promise<PedidoInterno[]> {
    this.calls.consultarPedidos.push(params)

    if (this.unavailable) {
      throw new GatewayUnavailableError('InMemoryGatewayClient')
    }

    let result = [...this.pedidosStore]

    if (params.numeroPedido) {
      result = result.filter(p => p.numeroPedido === params.numeroPedido)
    }
    if (params.clienteId) {
      result = result.filter(p => p.clienteId === params.clienteId)
    }

    return result
  }

  async consultarClientes(params: ConsultarClientesParams): Promise<ClienteInterno[]> {
    this.calls.consultarClientes.push(params)

    if (this.unavailable) {
      throw new GatewayUnavailableError('InMemoryGatewayClient')
    }

    let result = [...this.clientesStore]

    if (params.clienteId) {
      result = result.filter(c => c.clienteId === params.clienteId)
    }
    if (params.documentoToken) {
      result = result.filter(c => c.documentoToken === params.documentoToken)
    }

    return result
  }

  async reidentificarCliente(params: ReidentificarClienteParams): Promise<ClientePiiView | null> {
    this.calls.reidentificarCliente.push(params)

    if (this.unavailable) {
      throw new GatewayUnavailableError('InMemoryGatewayClient')
    }

    const found = this.clientesPiiStore.find(
      c => c.clienteId === params.clienteId && c.loja === params.loja,
    )
    return found ?? null
  }
}
