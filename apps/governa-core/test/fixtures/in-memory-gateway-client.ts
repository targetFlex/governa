import type { IGatewayClient, ConsultarPedidosParams, ConsultarClientesParams } from '../../src/shared/ports/gateway-client.port'
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
  private pedidosStore: PedidoInterno[]   = []
  private clientesStore: ClienteInterno[] = []
  private unavailable = false

  /** Calls registradas para inspeção nos testes */
  readonly calls: {
    consultarPedidos: ConsultarPedidosParams[]
    consultarClientes: ConsultarClientesParams[]
  } = {
    consultarPedidos:  [],
    consultarClientes: [],
  }

  /** Adiciona pedidos ao store */
  seedPedidos(pedidos: PedidoInterno[]): void {
    this.pedidosStore.push(...pedidos)
  }

  /** Adiciona clientes ao store */
  seedClientes(clientes: ClienteInterno[]): void {
    this.clientesStore.push(...clientes)
  }

  /** Faz o próximo call lançar GatewayUnavailableError */
  simulateUnavailable(value = true): void {
    this.unavailable = value
  }

  /** Limpa todo estado */
  clear(): void {
    this.pedidosStore   = []
    this.clientesStore  = []
    this.unavailable    = false
    this.calls.consultarPedidos  = []
    this.calls.consultarClientes = []
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
}
