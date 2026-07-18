// ============================================================
// cliente.model.ts
//
// Tipagem do domínio Cliente conforme contrato GET /clientes
// do governa-core (painel administrativo).
//
// Campos PII (nome, documento, endereço, e-mail, telefone) são
// pseudonimizados via HMAC SHA-256 no governa-gateway (D16) — o
// core nunca vê nem repassa o valor real, só o token. Exibição
// em texto claro exige reidentificação explícita e auditada —
// ver ClientePii e ClientePiiService.
// ============================================================

export interface Cliente {
  clienteId: string;
  loja: string;
  nomeToken: string;
  documentoToken: string;
  enderecoToken: string;
  emailToken: string | null;
  telefoneToken: string | null;
  bloqueado: boolean;
}

export interface ClientesResponse {
  data: Cliente[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * ClientePii — PII em texto claro de um cliente, resolvida sob demanda
 * via GET /clientes/:clienteId/reidentificar (uso restrito ao painel
 * humano, nunca cacheado além da sessão do componente).
 */
export interface ClientePii {
  clienteId: string;
  loja: string;
  nome: string;
  documento: string;
  email: string | null;
  telefone: string | null;
  endereco: string;
}

export interface ClientePiiResponse {
  data: ClientePii;
  traceId: string;
  latencyMs: number;
}
