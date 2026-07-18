import type { PedidoInterno } from '../../modules/pedidos/domain/pedido.entity'
import type { ClienteInterno } from '../../modules/clientes/domain/cliente.entity'

/**
 * ConsultarPedidosParams — filtros de busca de pedidos.
 * Todos opcionais — sem filtro retorna todos do tenant.
 */
export interface ConsultarPedidosParams {
  numeroPedido?: string
  clienteId?:    string
  dataInicio?:   string   // YYYYMMDD
  dataFim?:      string   // YYYYMMDD
}

/**
 * ConsultarClientesParams — filtros de busca de clientes.
 */
export interface ConsultarClientesParams {
  clienteId?:      string
  documentoToken?: string  // busca por HMAC do documento fiscal
}

/**
 * ReidentificarClienteParams — chave composta para reidentificação.
 */
export interface ReidentificarClienteParams {
  clienteId: string
  loja:      string
}

/**
 * ClientePiiView — PII em texto claro de um cliente.
 *
 * Uso restrito: exibição no painel humano (uso humano, nunca repassado
 * a um agente de IA). Ver ReidentificarClienteUseCase.
 */
export interface ClientePiiView {
  readonly clienteId: string
  readonly loja:      string
  readonly nome:      string
  readonly documento: string
  readonly email:     string | null
  readonly telefone:  string | null
  readonly endereco:  string
}

/**
 * IGatewayClient — PORTA (hexagonal).
 *
 * Contrato que o governa-core declara para acessar dados externos.
 * O core não sabe se do outro lado há HTTP, gRPC ou mock — isso é detalhe
 * de infraestrutura que vive no adaptador.
 *
 * Implementações:
 *   - HttpGatewayClient (infrastructure/) — chama governa-gateway via REST
 *   - InMemoryGatewayClient (test/fixtures/) — fake para testes unitários
 *
 * Contrato de erro:
 *   - Lança GatewayUnavailableError se o gateway não responder
 *   - Retorna [] se não houver resultados (nunca null)
 */
export interface IGatewayClient {
  consultarPedidos(params: ConsultarPedidosParams): Promise<PedidoInterno[]>
  consultarClientes(params: ConsultarClientesParams): Promise<ClienteInterno[]>
  /** @returns null se o cliente não existir (nunca lança NotFound) */
  reidentificarCliente(params: ReidentificarClienteParams): Promise<ClientePiiView | null>
}
