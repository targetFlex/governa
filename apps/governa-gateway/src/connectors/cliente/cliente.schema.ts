// ============================================================
// cliente.schema.ts — Schema Zod + interfaces do domínio cliente
//
// Fonte de verdade para:
//   - Validação da resposta raw do Protheus (ProtheusCilenteSchema)
//     Tabela TOTVS: SA1 (Cadastro de Clientes)
//   - Contrato interno de saída do conector (ClienteInterno)
//
// Campos PII (pseudonimizados no mapper):
//   A1_CGC   — CNPJ ou CPF
//   A1_EMAIL  — e-mail
//   A1_TEL   — telefone principal
//
// SRP: este módulo NÃO contém lógica de mapeamento nem de I/O.
// ============================================================

import { z } from 'zod'

// ── Schema da resposta raw do Protheus (SA1) ─────────────────

export const ProtheusCilenteSchema = z.object({
  A1_COD:   z.string(),
  A1_LOJA:  z.string(),
  A1_NOME:  z.string(),
  A1_END:   z.string(),
  A1_MUN:   z.string(),
  A1_EST:   z.string(),
  A1_CEP:   z.string().regex(/^\d{8}$/, 'A1_CEP deve ser 8 dígitos numéricos'),
  A1_CGC:   z.string(),                          // CNPJ ou CPF — PII
  A1_EMAIL: z.string().optional().default(''),   // e-mail — PII (opcional no Protheus)
  A1_TEL:   z.string().optional().default(''),   // telefone — PII (opcional no Protheus)
  A1_TIPO:  z.enum(['F', 'J'], {
    errorMap: () => ({ message: "A1_TIPO deve ser 'F' (Física) | 'J' (Jurídica)" }),
  }),
  A1_ATIVO: z.enum(['S', 'N'], {
    errorMap: () => ({ message: "A1_ATIVO deve ser 'S' (ativo) | 'N' (inativo)" }),
  }),
})

export type ProtheusCilenteRaw = z.infer<typeof ProtheusCilenteSchema>

// ── Modelo interno — independente da estrutura TOTVS ─────────

export type TipoCliente = 'FISICA' | 'JURIDICA'

export interface ClienteEndereco {
  logradouro: string
  municipio:  string
  estado:     string
  cep:        string
}

export interface ClienteInterno {
  codigoCliente:   string
  loja:            string
  nome:            string
  tipo:            TipoCliente
  ativo:           boolean
  /** HMAC SHA-256 do CNPJ/CPF original — nunca o valor real */
  documentoPseudo: string
  /** HMAC SHA-256 do e-mail — null se ausente/vazio no Protheus */
  emailPseudo:     string | null
  /** HMAC SHA-256 do telefone — null se ausente/vazio no Protheus */
  telefonePseudo:  string | null
  endereco:        ClienteEndereco
}

// ── Mapas de conversão Protheus → domínio ────────────────────

export const TIPO_MAP: Record<string, TipoCliente> = {
  F: 'FISICA',
  J: 'JURIDICA',
}
