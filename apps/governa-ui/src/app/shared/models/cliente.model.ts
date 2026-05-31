// ============================================================
// cliente.model.ts
//
// Tipagem do domínio Cliente conforme contrato GET /clientes
// do governa-gateway (Protheus adapter).
// ============================================================

export type TipoPessoa = 'PF' | 'PJ';

export interface Cliente {
  id: string;
  codigo: string;
  nome: string;
  tipoPessoa: TipoPessoa;
  documento: string;          // CPF ou CNPJ
  email: string;
  telefone: string | null;
  ativo: boolean;
  limiteCredito: number;
  saldoDevedor: number;
  moeda: string;
  criadoEm: string;           // ISO 8601
  atualizadoEm: string;       // ISO 8601
}

export interface ClientesResponse {
  data: Cliente[];
  total: number;
  page: number;
  pageSize: number;
}
