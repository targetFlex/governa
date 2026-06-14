/**
 * Erros de domínio do módulo clientes.
 *
 * ClienteNotFoundError — busca específica por clienteId ou documentoToken
 *   sem resultado.
 * GatewayUnavailableError — re-exportado do módulo pedidos para manter
 *   consistência de contrato (o erro de rede é compartilhado).
 */
export class ClienteNotFoundError extends Error {
  readonly code = 'CLIENTE_NOT_FOUND'

  constructor(identifier: string) {
    super(`Cliente não encontrado: ${identifier}`)
    this.name = 'ClienteNotFoundError'
  }
}

export { GatewayUnavailableError } from '../../pedidos/domain/pedido.errors'
