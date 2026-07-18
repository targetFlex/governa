// ============================================================
// read-protheus-cliente.connector.ts
//
// Conector que busca clientes no Protheus via GET /CLIENTE/.
// Valida a resposta com Zod, pseudonimiza PII e mapeia para
// ClienteInterno.
//
// Upstream:   TOTVS Protheus REST — endpoint /CLIENTE/ (SA1)
// Downstream: governa-core (consome ClienteInterno[])
//
// Dicionário de erros: connectors/shared/upstream-error.handler.ts
// Schema:              connectors/cliente/cliente.schema.ts
// Mapper:              connectors/cliente/cliente.mapper.ts
// PII:                 connectors/shared/pii.pseudonymizer.ts
// ============================================================

import { AxiosInstance } from 'axios'
import { ProtheusCilenteSchema, ClienteInterno, ClientePiiView } from './cliente.schema'
import { ClienteMapper } from './cliente.mapper'
import { handleUpstreamError } from '../shared/upstream-error.handler'

// ── Parâmetros de busca ──────────────────────────────────────

export interface ReadClienteParams {
  codigoCliente?:   string   // A1_COD
  loja?:            string   // A1_LOJA
  cgc?:             string   // A1_CGC — CNPJ ou CPF (busca por documento)
  ativo?:           'S' | 'N'
  /**
   * HMAC SHA-256 do documento fiscal, já pseudonimizado.
   * Protheus não indexa o hash (só A1_CGC em claro) — o filtro é
   * aplicado client-side após pseudonimizar cada registro retornado.
   */
  documentoToken?:  string
}

// ── Parâmetros de reidentificação ────────────────────────────

export interface ReadClientePiiParams {
  codigoCliente: string   // A1_COD — obrigatório, busca de registro único
  loja:          string   // A1_LOJA — obrigatório, compõe a chave composta
}

// ── Conector ─────────────────────────────────────────────────

export class ReadProtheusCilenteConnector {
  constructor(
    private readonly http:   AxiosInstance,
    private readonly mapper: ClienteMapper,
  ) {}

  /**
   * Executa a busca de clientes no Protheus.
   * Campos PII da resposta são pseudonimizados antes de retornar.
   *
   * @param params - Filtros opcionais de busca
   * @returns Lista de ClienteInterno (pode ser vazia)
   * @throws UpstreamError — falha HTTP mapeada pelo dicionário
   * @throws ZodError     — resposta do Protheus não bate com o schema
   */
  async execute(params: ReadClienteParams): Promise<ClienteInterno[]> {
    let rawData: unknown

    try {
      const res = await this.http.get('/CLIENTE/', {
        params: this.buildQuery(params),
      })
      rawData = res.data
    } catch (error) {
      throw handleUpstreamError(error, 'read_protheus_cliente')
    }

    // Validar e mapear — ZodError propaga se schema inválido
    const rawList = this.extractList(rawData)
    const validated = rawList.map((item) => ProtheusCilenteSchema.parse(item))
    const mapped = validated.map((raw) => this.mapper.toInterno(raw))

    if (params.documentoToken) {
      return mapped.filter((c) => c.documentoPseudo === params.documentoToken)
    }
    return mapped
  }

  /**
   * Busca um único cliente por chave composta (codigoCliente+loja) e
   * retorna a view de reidentificação — PII em texto claro, sem
   * pseudonimização. Uso restrito: painel humano (ver ClientePiiView).
   *
   * @returns null se o cliente não existir (nunca lança NotFound)
   */
  async executePii(params: ReadClientePiiParams): Promise<ClientePiiView | null> {
    let rawData: unknown

    try {
      const res = await this.http.get('/CLIENTE/', {
        params: this.buildQuery({ codigoCliente: params.codigoCliente, loja: params.loja }),
      })
      rawData = res.data
    } catch (error) {
      throw handleUpstreamError(error, 'read_protheus_cliente_pii')
    }

    const rawList = this.extractList(rawData)
    if (rawList.length === 0) return null

    const validated = ProtheusCilenteSchema.parse(rawList[0])
    return this.mapper.toPlaintextView(validated)
  }

  // ── Helpers privados ────────────────────────────────────────

  /**
   * Monta query string a partir dos parâmetros fornecidos.
   * Campos ausentes são omitidos (não enviados ao Protheus).
   */
  private buildQuery(params: ReadClienteParams): Record<string, string> {
    const q: Record<string, string> = {}
    if (params.codigoCliente) q['A1_COD']  = params.codigoCliente
    if (params.loja)          q['A1_LOJA'] = params.loja
    if (params.cgc)           q['A1_CGC']  = params.cgc
    if (params.ativo)         q['A1_ATIVO']= params.ativo
    return q
  }

  /**
   * Extrai lista de itens da resposta do Protheus.
   * Suporta dois formatos:
   *   - Array direto: [{ A1_COD: ... }, ...]
   *   - Envelope:     { items: [{ A1_COD: ... }, ...] }
   */
  private extractList(data: unknown): unknown[] {
    if (Array.isArray(data)) return data
    const envelope = data as Record<string, unknown>
    if (Array.isArray(envelope?.items)) return envelope.items
    return []
  }
}
