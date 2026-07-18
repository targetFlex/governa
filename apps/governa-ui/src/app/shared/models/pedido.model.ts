// ============================================================
// pedido.model.ts
//
// Tipagem do domínio Pedido conforme contrato GET /pedidos
// do governa-core (painel administrativo).
//
// PedidoInterno nunca carrega nome de cliente em texto claro —
// só clienteId/loja (chave de negócio, não PII). Para exibir o
// nome do cliente, use ClientePiiService com (clienteId, loja).
// ============================================================

export type StatusPedido = 'ABERTO' | 'BLOQUEADO' | 'ENCERRADO' | 'LIBERADO';

export interface ItemPedido {
  codigoProduto: string;
  quantidade: number;
  precoUnitario: number;
}

export interface Pedido {
  numeroPedido: string;
  clienteId: string;
  loja: string;
  dataEmissao: string;       // ISO 8601
  valorTotal: number;
  status: StatusPedido;
  itens: ItemPedido[];
}

export interface PedidosResponse {
  data: Pedido[];
  total: number;
  page: number;
  pageSize: number;
}
