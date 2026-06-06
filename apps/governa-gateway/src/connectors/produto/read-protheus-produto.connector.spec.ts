// ============================================================
// read-protheus-produto.connector.spec.ts
// ============================================================

import { AxiosInstance } from 'axios'
import { ZodError } from 'zod'
import { ReadProtheusProdutoConnector, ReadProdutoParams } from './read-protheus-produto.connector'
import { ProdutoMapper } from './produto.mapper'
import { UpstreamError } from '../shared/upstream-error.handler'

// ── Helpers ────────────────────────────────────────────────

function makeRawProduto(overrides: Record<string, unknown> = {}) {
  return {
    B1_COD:    'PROD001',
    B1_DESC:   'Produto de Teste',
    B1_UM:     'UN',
    B1_TIPO:   'PA',
    B1_PRV1:   99.90,
    B1_LOCPAD: 'A-01-01',
    B1_MSBLQ:  '1',
    ...overrides,
  }
}

function makeHttp(data: unknown, status = 200): jest.Mocked<Pick<AxiosInstance, 'get'>> {
  return {
    get: jest.fn().mockResolvedValue({ data, status }),
  } as any
}

function makeHttpError(httpStatus: number) {
  const err: any = new Error(`HTTP ${httpStatus}`)
  err.response = { status: httpStatus, data: {} }
  return {
    get: jest.fn().mockRejectedValue(err),
  } as any
}

function makeConnector(http: any, mapper = new ProdutoMapper()) {
  return new ReadProtheusProdutoConnector(http as AxiosInstance, mapper)
}

// ── Testes ─────────────────────────────────────────────────

describe('ReadProtheusProdutoConnector', () => {

  // ── Critério 1: resposta válida → ProdutoInterno[] ────────

  it('retorna ProdutoInterno[] para resposta válida em array direto', async () => {
    const http = makeHttp([makeRawProduto()])
    const result = await makeConnector(http).execute({})

    expect(result).toHaveLength(1)
    expect(result[0].codigoProduto).toBe('PROD001')
    expect(result[0].descricao).toBe('Produto de Teste')
    expect(result[0].unidadeMedida).toBe('UN')
    expect(result[0].tipo).toBe('PRODUTO_ACABADO')
    expect(result[0].precoVenda).toBe(99.90)
    expect(result[0].localizacaoPadrao).toBe('A-01-01')
    expect(result[0].bloqueado).toBe(false)
  })

  it('retorna ProdutoInterno[] para resposta em envelope { items: [...] }', async () => {
    const http = makeHttp({ items: [makeRawProduto()] })
    const result = await makeConnector(http).execute({})
    expect(result).toHaveLength(1)
    expect(result[0].codigoProduto).toBe('PROD001')
  })

  it('retorna array vazio para resposta vazia', async () => {
    const http = makeHttp([])
    const result = await makeConnector(http).execute({})
    expect(result).toEqual([])
  })

  it('retorna array vazio para envelope com items vazio', async () => {
    const http = makeHttp({ items: [] })
    const result = await makeConnector(http).execute({})
    expect(result).toEqual([])
  })

  it('retorna array vazio para resposta sem formato reconhecível', async () => {
    const http = makeHttp({ total: 0 })
    const result = await makeConnector(http).execute({})
    expect(result).toEqual([])
  })

  // ── Critério 2: schema inválido → ZodError ────────────────

  it('lança ZodError quando B1_TIPO está fora do enum', async () => {
    const http = makeHttp([makeRawProduto({ B1_TIPO: 'XX' })])
    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  it('lança ZodError quando B1_COD está ausente', async () => {
    const raw = makeRawProduto()
    delete (raw as any).B1_COD
    const http = makeHttp([raw])
    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  it('lança ZodError quando B1_PRV1 não é número', async () => {
    const http = makeHttp([makeRawProduto({ B1_PRV1: 'não-numero' })])
    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  it('lança ZodError quando B1_MSBLQ está fora do enum', async () => {
    const http = makeHttp([makeRawProduto({ B1_MSBLQ: '3' })])
    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  // ── Critério 3: erros HTTP → UpstreamError ────────────────

  it('lança UpstreamError com code PROTHEUS_NOT_FOUND para 404', async () => {
    const http = makeHttpError(404)
    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({
        name:   'UpstreamError',
        code:   'PROTHEUS_NOT_FOUND',
        source: 'read_protheus_produto',
      })
  })

  it('lança UpstreamError com code PROTHEUS_RATE_LIMITED para 429', async () => {
    const http = makeHttpError(429)
    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_RATE_LIMITED' })
  })

  it('lança UpstreamError com code PROTHEUS_INTERNAL_ERROR para 500', async () => {
    const http = makeHttpError(500)
    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_INTERNAL_ERROR' })
  })

  it('lança UpstreamError com code PROTHEUS_UNAUTHORIZED para 401', async () => {
    const http = makeHttpError(401)
    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_UNAUTHORIZED' })
  })

  // ── Critério 4: buildQuery ────────────────────────────────

  it('envia B1_COD na query quando codigoProduto fornecido', async () => {
    const http = makeHttp([makeRawProduto({ B1_COD: 'PROD999' })])
    await makeConnector(http).execute({ codigoProduto: 'PROD999' })
    expect(http.get).toHaveBeenCalledWith('/PRODUTO/', {
      params: { B1_COD: 'PROD999' },
    })
  })

  it('envia B1_TIPO na query quando tipo fornecido', async () => {
    const http = makeHttp([makeRawProduto({ B1_TIPO: 'MA' })])
    await makeConnector(http).execute({ tipo: 'MA' })
    expect(http.get).toHaveBeenCalledWith('/PRODUTO/', {
      params: { B1_TIPO: 'MA' },
    })
  })

  it('envia B1_MSBLQ na query quando bloqueado fornecido', async () => {
    const http = makeHttp([makeRawProduto({ B1_MSBLQ: '2' })])
    await makeConnector(http).execute({ bloqueado: '2' })
    expect(http.get).toHaveBeenCalledWith('/PRODUTO/', {
      params: { B1_MSBLQ: '2' },
    })
  })

  it('omite parâmetros ausentes da query', async () => {
    const http = makeHttp([])
    await makeConnector(http).execute({})
    expect(http.get).toHaveBeenCalledWith('/PRODUTO/', { params: {} })
  })

  // ── Critério 5: todos os tipos mapeados ───────────────────

  it('mapeia produto PA corretamente', async () => {
    const http = makeHttp([makeRawProduto({ B1_TIPO: 'PA' })])
    const [p] = await makeConnector(http).execute({})
    expect(p.tipo).toBe('PRODUTO_ACABADO')
  })

  it('mapeia produto SC corretamente', async () => {
    const http = makeHttp([makeRawProduto({ B1_TIPO: 'SC' })])
    const [p] = await makeConnector(http).execute({})
    expect(p.tipo).toBe('SERVICO')
  })

  // ── Critério 6: localizacao vazia → null ──────────────────

  it('localizacaoPadrao é null quando B1_LOCPAD vazio', async () => {
    const http = makeHttp([makeRawProduto({ B1_LOCPAD: '' })])
    const [p] = await makeConnector(http).execute({})
    expect(p.localizacaoPadrao).toBeNull()
  })

  it('localizacaoPadrao é null quando B1_LOCPAD ausente (default vazio)', async () => {
    const raw = makeRawProduto()
    delete (raw as any).B1_LOCPAD
    const http = makeHttp([raw])
    const [p] = await makeConnector(http).execute({})
    expect(p.localizacaoPadrao).toBeNull()
  })
})
