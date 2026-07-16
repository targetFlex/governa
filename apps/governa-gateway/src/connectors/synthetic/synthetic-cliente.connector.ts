// ============================================================
// synthetic-cliente.connector.ts
//
// Implementação de IClienteConnector que serve dados sintéticos
// (fixtures/synthetic-fixtures.ts) em vez de consultar o Protheus
// real. Ativada via PROTHEUS_MODE=synthetic — usada no piloto
// sandbox Target Flex, antes do DPA e de credenciais Protheus reais.
// ============================================================

import { ReadClienteParams } from '../cliente/read-protheus-cliente.connector'
import { ClienteInterno } from '../cliente/cliente.schema'
import { SYNTHETIC_CLIENTES } from './synthetic-fixtures'

export class SyntheticClienteConnector {
  async execute(params: ReadClienteParams): Promise<ClienteInterno[]> {
    return SYNTHETIC_CLIENTES.filter((c) => {
      if (params.codigoCliente && c.codigoCliente !== params.codigoCliente) return false
      if (params.loja && c.loja !== params.loja) return false
      if (params.ativo && c.ativo !== (params.ativo === 'S')) return false
      return true
    })
  }
}
