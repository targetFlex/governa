/**
 * Erros de domínio do módulo de pedidos.
 * Desacoplados de HTTP — o router decide o status code.
 */
export class PedidoNotFoundError extends Error {
  readonly code = 'PEDIDO_NOT_FOUND'
  constructor(numeroPedido: string) {
    super(`Pedido ${numeroPedido} não encontrado`)
    this.name = 'PedidoNotFoundError'
  }
}

export class GatewayUnavailableError extends Error {
  readonly code = 'GATEWAY_UNAVAILABLE'
  constructor(source: string) {
    super(`Gateway indisponível: ${source}`)
    this.name = 'GatewayUnavailableError'
  }
}
