// ============================================================
// read-protheus-produto.connector.ts
//
// Conector que busca produtos no Protheus via GET /PRODUTO/.
// Valida a resposta com Zod e mapeia para ProdutoInterno.
//
// Upstream:   TOTVS Protheus REST — endpoint /PRODUTO/ (SB1)
// Downstream: governa-core (consome ProdutoInterno[])
//
// Dicionário de erros: connectors/shared/upstream-error.handler.ts
// Schema:              connectors/produto/produto.schema.ts
// Mapper:              connectors/produto/produto.mapper.ts
// ============================================================

import { AxiosInstance } from 'axios'
import { ProtheusProdutoSchema, ProdutoInterno } from './produto.schema'
import { ProdutoMapper } from './produto.mapper'
import { handleUpstreamError } from '../shared/upstream-error.handler'

// ── Parâmetros de busca ──────────────────────────────────────

export interface ReadProdutoParams {
  codigoProduto?: string       // B1_COD
  tipo?:          'PA' | 'MA' | 'ME' | 'SC'  // B1_TIPO
  bloqueado?:     '1' | '2'   // B1_MSBLQ — '1' desbloqueado | '2' bloqueado
}

// ── Conector ─────────────────────────────────────────────────

export class ReadProtheusProdutoConnector {
  constructor(
    private readonly http:   AxiosInstance,
    private readonly mapper: ProdutoMapper,
  ) {}

  /**
   * Executa a busca de produtos no Protheus.
   *
   * @param params - Filtros opcionais de busca
   * @returns Lista de ProdutoInterno (pode ser vazia)
   * @throws UpstreamError — falha HTTP mapeada pelo dicionário
   * @throws ZodError     — resposta do Protheus não bate com o schema
   */
  async execute(params: ReadProdutoParams): Promise<ProdutoInterno[]> {
    let rawData: unknown

    try {
      const res = await this.http.get('/PRODUTO/', {
        params: this.buildQuery(params),
      })
      rawData = res.data
    } catch (error) {
      throw handleUpstreamError(error, 'read_protheus_produto')
    }

    // Validar e mapear — ZodError propaga se schema inválido
    const rawList = this.extractList(rawData)
    const validated = rawList.map((item) => ProtheusProdutoSchema.parse(item))
    return validated.map((raw) => this.mapper.toInterno(raw))
  }

  // ── Helpers privados ────────────────────────────────────────

  /**
   * Monta query string a partir dos parâmetros fornecidos.
   * Campos ausentes são omitidos (não enviados ao Protheus).
   */
  private buildQuery(params: ReadProdutoParams): Record<string, string> {
    const q: Record<string, string> = {}
    if (params.codigoProduto) q['B1_COD']   = params.codigoProduto
    if (params.tipo)          q['B1_TIPO']  = params.tipo
    if (params.bloqueado)     q['B1_MSBLQ'] = params.bloqueado
    return q
  }

  /**
   * Extrai lista de itens da resposta do Protheus.
   * Suporta dois formatos:
   *   - Array direto: [{ B1_COD: ... }, ...]
   *   - Envelope:     { items: [{ B1_COD: ... }, ...] }
   */
  private extractList(data: unknown): unknown[] {
    if (Array.isArray(data)) return data
    const envelope = data as Record<string, unknown>
    if (Array.isArray(envelope?.items)) return envelope.items
    return []
  }
}
