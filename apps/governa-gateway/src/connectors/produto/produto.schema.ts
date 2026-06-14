// ============================================================
// produto.schema.ts — Schema Zod + interfaces do domínio produto
//
// Fonte de verdade para:
//   - Validação da resposta raw do Protheus (ProtheusProdutoSchema)
//     Tabela TOTVS: SB1 (Cadastro de Produtos)
//   - Contrato interno de saída do conector (ProdutoInterno)
//
// Campos SB1 mapeados:
//   B1_COD    — código do produto (chave)
//   B1_DESC   — descrição
//   B1_UM     — unidade de medida (ex: UN, KG, MT, CX)
//   B1_TIPO   — tipo: PA (Produto Acabado), MA (Matéria-Prima),
//               ME (Mercadoria), SC (Serviço)
//   B1_PRV1   — preço de venda 1 (tabela padrão)
//   B1_LOCPAD — localização padrão no estoque (opcional)
//   B1_MSBLQ  — flag de bloqueio: '1' = desbloqueado, '2' = bloqueado
//
// SRP: este módulo NÃO contém lógica de mapeamento nem de I/O.
// ============================================================

import { z } from 'zod'

// ── Schema da resposta raw do Protheus (SB1) ─────────────────

export const ProtheusProdutoSchema = z.object({
  B1_COD:    z.string(),
  B1_DESC:   z.string(),
  B1_UM:     z.string(),
  B1_TIPO:   z.enum(['PA', 'MA', 'ME', 'SC'], {
    errorMap: () => ({
      message: "B1_TIPO deve ser 'PA' | 'MA' | 'ME' | 'SC'",
    }),
  }),
  B1_PRV1:   z.number(),
  B1_LOCPAD: z.string().optional().default(''),  // localização pode estar ausente no Protheus
  B1_MSBLQ:  z.enum(['1', '2'], {
    errorMap: () => ({
      message: "B1_MSBLQ deve ser '1' (desbloqueado) | '2' (bloqueado)",
    }),
  }),
})

export type ProtheusProdutoRaw = z.infer<typeof ProtheusProdutoSchema>

// ── Modelo interno — independente da estrutura TOTVS ─────────

export type TipoProduto =
  | 'PRODUTO_ACABADO'
  | 'MATERIA_PRIMA'
  | 'MERCADORIA'
  | 'SERVICO'

export interface ProdutoInterno {
  codigoProduto:      string
  descricao:          string
  unidadeMedida:      string
  tipo:               TipoProduto
  precoVenda:         number
  /** Localização no estoque — null quando não configurada no Protheus */
  localizacaoPadrao:  string | null
  bloqueado:          boolean
}

// ── Mapa de tipos Protheus → domínio interno ─────────────────

export const TIPO_MAP: Record<string, TipoProduto> = {
  PA: 'PRODUTO_ACABADO',
  MA: 'MATERIA_PRIMA',
  ME: 'MERCADORIA',
  SC: 'SERVICO',
}
