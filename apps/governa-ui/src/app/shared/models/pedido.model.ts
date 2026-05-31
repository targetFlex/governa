// ============================================================
// pedido.model.ts
//
// Tipagem do domínio Pedido conforme contrato GET /pedidos
// do governa-gateway (Protheus adapter).
// ============================================================

export type StatusPedido =
  | 'ABERTO'
  | 'EM_APROVACAO'
  | 'APROVADO'
  | 'CANCELADO'
  | 'ENCERRADO';

export interface Pedido {
  id: string;
  numero: string;
  clienteId: string;
  clienteNome: string;
  status: StatusPedido;
  valor: number;
  moeda: string;
  dataEmissao: string;       // ISO 8601
  dataEntregaPrevista: string | null;
  itens: PedidoItem[];
}

export interface PedidoItem {
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface PedidosResponse {
  data: Pedido[];
  total: number;
  page: number;
  pageSize: number;
}
