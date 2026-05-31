// ============================================================
// produto.mapper.ts — Conversão ProtheusProdutoRaw → ProdutoInterno
//
// SRP: apenas mapeamento de campos. Nenhuma validação de schema
//      e nenhuma lógica HTTP vivem aqui.
//
// Sem pseudonimização: produto não contém campos PII.
// ============================================================

import {
  ProdutoInterno,
  ProtheusProdutoRaw,
  TIPO_MAP,
} from './produto.schema'

export class ProdutoMapper {
  /**
   * Converte um produto raw (já validado pelo Zod) para o modelo interno.
   *
   * Conversões:
   *   B1_TIPO  'PA'|'MA'|'ME'|'SC' → TipoProduto (enum interno)
   *   B1_MSBLQ '1' → false / '2' → true
   *   B1_LOCPAD '' ou ausente      → null
   */
  toInterno(raw: ProtheusProdutoRaw): ProdutoInterno {
    return {
      codigoProduto:     raw.B1_COD,
      descricao:         raw.B1_DESC,
      unidadeMedida:     raw.B1_UM,
      tipo:              TIPO_MAP[raw.B1_TIPO],
      precoVenda:        raw.B1_PRV1,
      localizacaoPadrao: this.parseLocalizacao(raw.B1_LOCPAD),
      bloqueado:         raw.B1_MSBLQ === '2',
    }
  }

  // ── Helpers privados ────────────────────────────────────────

  /**
   * Converte localização vazia ou somente espaços para null.
   * Protheus frequentemente retorna `B1_LOCPAD = '   '` para produtos
   * sem localização configurada.
   */
  private parseLocalizacao(value: string | undefined): string | null {
    if (!value || value.trim() === '') return null
    return value.trim()
  }
}
