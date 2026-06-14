/**
 * PedidoInterno — entidade de domínio do governa-core.
 *
 * Independente do Protheus: não importa nenhum schema TOTVS.
 * O gateway é responsável por mapear C5_* → PedidoInterno.
 *
 * Imutável por construção (readonly em todos os campos).
 */
export interface ItemPedido {
  readonly codigoProduto: string
  readonly quantidade:    number
  readonly precoUnitario: number
}

export type StatusPedido = 'ABERTO' | 'BLOQUEADO' | 'ENCERRADO' | 'LIBERADO'

export interface PedidoInterno {
  readonly numeroPedido:  string
  readonly clienteId:     string
  readonly loja:          string
  readonly dataEmissao:   Date
  readonly valorTotal:    number
  readonly status:        StatusPedido
  readonly itens:         readonly ItemPedido[]
}
