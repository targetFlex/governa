// ============================================================
// produto.edge.spec.ts — Edge cases do conector read_protheus_produto
//
// Cenários extremos que não devem passar silenciosamente.
// Separados dos testes unitários para rastreabilidade em CI.
// ============================================================

import { AxiosInstance } from 'axios'
import { ZodError } from 'zod'
import { ReadProtheusProdutoConnector } from '../../src/connectors/produto/read-protheus-produto.connector'
import { ProdutoMapper } from '../../src/connectors/produto/produto.mapper'
import { UpstreamError } from '../../src/connectors/shared/upstream-error.handler'

// ── Helpers ────────────────────────────────────────────────

function makeRawProduto(overrides: Record<string, unknown> = {}) {
  return {
    B1_COD:    'PROD001',
    B1_DESC:   'Produto Edge',
    B1_UM:     'UN',
    B1_TIPO:   'PA',
    B1_PRV1:   10.00,
    B1_LOCPAD: 'X-00-00',
    B1_MSBLQ:  '1',
    ...overrides,
  }
}

function makeConnector(httpMock: any) {
  return new ReadProtheusProdutoConnector(httpMock as AxiosInstance, new ProdutoMapper())
}

// ── Edge cases ─────────────────────────────────────────────

describe('read_protheus_produto — edge cases', () => {

  // EC-1: lista vazia não é erro
  it('Protheus retorna lista vazia → retorna array vazio, sem erro', async () => {
    const http = { get: jest.fn().mockResolvedValue({ data: [] }) }
    const result = await makeConnector(http).execute({})
    expect(result).toEqual([])
    expect(Array.isArray(result)).toBe(true)
  })

  // EC-2: B1_PRV1 = 0 é válido (produto sem preço cadastrado)
  it('B1_PRV1 = 0 → mapeado sem erro (produto sem preço)', async () => {
    const http = {
      get: jest.fn().mockResolvedValue({ data: [makeRawProduto({ B1_PRV1: 0 })] }),
    }
    const [result] = await makeConnector(http).execute({})
    expect(result.precoVenda).toBe(0)
  })

  // EC-3: B1_TIPO inválido → ZodError (não silencioso)
  it('B1_TIPO inválido → ZodError com mensagem descritiva', async () => {
    const http = {
      get: jest.fn().mockResolvedValue({ data: [makeRawProduto({ B1_TIPO: 'ZZ' })] }),
    }
    const err = await makeConnector(http).execute({}).catch(e => e)
    expect(err).toBeInstanceOf(ZodError)
    expect(JSON.stringify(err.errors)).toContain("B1_TIPO deve ser 'PA'")
  })

  // EC-4: resposta mista válida + inválida → falha completa
  it('resposta mista válida + inválida → falha completa (não parcial)', async () => {
    const valido   = makeRawProduto({ B1_COD: 'OK001' })
    const invalido = makeRawProduto({ B1_MSBLQ: '9' })  // MSBLQ fora do enum
    const http = {
      get: jest.fn().mockResolvedValue({ data: [valido, invalido] }),
    }
    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  // EC-5: timeout Axios → UpstreamError com code PROTHEUS_TIMEOUT
  it('timeout Axios (ECONNABORTED) → UpstreamError com code PROTHEUS_TIMEOUT', async () => {
    const timeoutError: any = new Error('timeout of 10000ms exceeded')
    timeoutError.code = 'ECONNABORTED'
    const http = { get: jest.fn().mockRejectedValue(timeoutError) }

    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({
        name:   'UpstreamError',
        code:   'PROTHEUS_TIMEOUT',
        source: 'read_protheus_produto',
      })
  })

  // EC-6: ERR_NETWORK também mapeia para PROTHEUS_TIMEOUT
  it('ERR_NETWORK → UpstreamError com code PROTHEUS_TIMEOUT', async () => {
    const networkError: any = new Error('Network Error')
    networkError.code = 'ERR_NETWORK'
    const http = { get: jest.fn().mockRejectedValue(networkError) }

    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_TIMEOUT' })
  })

  // EC-7: múltiplos produtos com tipos diferentes → todos mapeados
  it('Protheus retorna múltiplos produtos → todos mapeados corretamente', async () => {
    const produtos = [
      makeRawProduto({ B1_COD: 'PA-001', B1_TIPO: 'PA' }),
      makeRawProduto({ B1_COD: 'MA-002', B1_TIPO: 'MA' }),
      makeRawProduto({ B1_COD: 'ME-003', B1_TIPO: 'ME' }),
      makeRawProduto({ B1_COD: 'SC-004', B1_TIPO: 'SC' }),
    ]
    const http = { get: jest.fn().mockResolvedValue({ data: produtos }) }
    const result = await makeConnector(http).execute({})

    expect(result).toHaveLength(4)
    expect(result[0].tipo).toBe('PRODUTO_ACABADO')
    expect(result[1].tipo).toBe('MATERIA_PRIMA')
    expect(result[2].tipo).toBe('MERCADORIA')
    expect(result[3].tipo).toBe('SERVICO')
  })

  // EC-8: envelope com items null → retorna array vazio sem erro
  it('envelope com items null → retorna array vazio sem erro', async () => {
    const http = {
      get: jest.fn().mockResolvedValue({ data: { items: null } }),
    }
    const result = await makeConnector(http).execute({})
    expect(result).toEqual([])
  })

  // EC-9: produto bloqueado (B1_MSBLQ = '2') → bloqueado: true
  it('produto bloqueado → mapeado com bloqueado: true', async () => {
    const http = {
      get: jest.fn().mockResolvedValue({ data: [makeRawProduto({ B1_MSBLQ: '2' })] }),
    }
    const [result] = await makeConnector(http).execute({})
    expect(result.bloqueado).toBe(true)
  })

  // EC-10: B1_LOCPAD com somente espaços → localizacaoPadrao: null
  it("B1_LOCPAD com somente espaços ('   ') → localizacaoPadrao: null", async () => {
    const http = {
      get: jest.fn().mockResolvedValue({ data: [makeRawProduto({ B1_LOCPAD: '   ' })] }),
    }
    const [result] = await makeConnector(http).execute({})
    expect(result.localizacaoPadrao).toBeNull()
  })
})
