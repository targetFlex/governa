// ============================================================
// synthetic-pedido.connector.ts
//
// Implementação de IPedidoConnector que serve dados sintéticos
// (fixtures/synthetic-fixtures.ts) em vez de consultar o Protheus
// real. Ativada via PROTHEUS_MODE=synthetic — usada no piloto
// sandbox Target Flex, antes do DPA e de credenciais Protheus reais.
// ============================================================

import { ReadPedidoParams } from '../pedido/read-protheus-pedido.connector'
import { PedidoInterno } from '../pedido/pedido.schema'
import { SYNTHETIC_PEDIDOS } from './synthetic-fixtures'

export class SyntheticPedidoConnector {
  async execute(params: ReadPedidoParams): Promise<PedidoInterno[]> {
    return SYNTHETIC_PEDIDOS.filter((p) => {
      if (params.numeroPedido && p.numeroPedido !== params.numeroPedido) return false
      if (params.clienteId && p.clienteId !== params.clienteId) return false
      return true
    })
  }
}
