import { AxiosInstance } from 'axios'
import { ZodError } from 'zod'
import { ReadProtheusPedidoConnector, ReadPedidoParams } from './read-protheus-pedido.connector'
import { PedidoMapper } from './pedido.mapper'
import { UpstreamError } from '../shared/upstream-error.handler'

// ── Helpers ────────────────────────────────────────────────

function makeRawPedido(overrides: Record<string, unknown> = {}) {
  return {
    C5_NUM:     '000001',
    C5_CLIENTE: 'CLI001',
    C5_LOJA:    '01',
    C5_EMISSAO: '20260524',
    C5_VALOR:   1500.00,
    C5_STATUS:  'A',
    C5_ITENS:   [{ D2_COD: 'PROD01', D2_QUANT: 2, D2_PRCVEN: 750.00 }],
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

function makeConnector(http: any, mapper = new PedidoMapper()) {
  return new ReadProtheusPedidoConnector(http as AxiosInstance, mapper)
}

// ── Testes ─────────────────────────────────────────────────

describe('ReadProtheusPedidoConnector', () => {
  // ── Critério 1: resposta válida → PedidoInterno[] ─────────

  it('retorna PedidoInterno[] para resposta válida em array direto', async () => {
    const http = makeHttp([makeRawPedido()])
    const result = await makeConnector(http).execute({})

    expect(result).toHaveLength(1)
    expect(result[0].numeroPedido).toBe('000001')
    expect(result[0].clienteId).toBe('CLI001')
    expect(result[0].loja).toBe('01')
    expect(result[0].valorTotal).toBe(1500.00)
    expect(result[0].status).toBe('ABERTO')
    expect(result[0].dataEmissao).toBeInstanceOf(Date)
    expect(result[0].dataEmissao.toISOString()).toBe('2026-05-24T00:00:00.000Z')
    expect(result[0].itens).toHaveLength(1)
  })

  it('retorna PedidoInterno[] para resposta em envelope { items: [...] }', async () => {
    const http = makeHttp({ items: [makeRawPedido()] })
    const result = await makeConnector(http).execute({})
    expect(result).toHaveLength(1)
    expect(result[0].numeroPedido).toBe('000001')
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

  // ── Critério 2: campo ausente → ZodError ──────────────────

  it('lança ZodError quando C5_NUM está ausente', async () => {
    const raw = makeRawPedido()
    delete (raw as any).C5_NUM
    const http = makeHttp([raw])

    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  it('lança ZodError quando C5_CLIENTE está ausente', async () => {
    const raw = makeRawPedido()
    delete (raw as any).C5_CLIENTE
    const http = makeHttp([raw])

    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  // ── Critério 3: Protheus 404 → PROTHEUS_NOT_FOUND ─────────

  it('lança UpstreamError PROTHEUS_NOT_FOUND em HTTP 404', async () => {
    const http = makeHttpError(404)
    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({
        name:       'UpstreamError',
        code:       'PROTHEUS_NOT_FOUND',
        httpStatus: 404,
        source:     'read_protheus_pedido',
      })
  })

  // ── Critério 4: Protheus 429 → PROTHEUS_RATE_LIMITED ──────

  it('lança UpstreamError PROTHEUS_RATE_LIMITED em HTTP 429', async () => {
    const http = makeHttpError(429)
    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({
        name:       'UpstreamError',
        code:       'PROTHEUS_RATE_LIMITED',
        httpStatus: 429,
        source:     'read_protheus_pedido',
      })
  })

  // ── Critério 5: C5_STATUS inválido → ZodError ────────────

  it('lança ZodError quando C5_STATUS tem valor fora do enum', async () => {
    const http = makeHttp([makeRawPedido({ C5_STATUS: 'X' })])
    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  // ── Critério 6: dataEmissao mapeada para Date ISO ─────────
  // (coberto pelo teste 1 — reforçado aqui para clareza)

  it('mapeia C5_EMISSAO 20260101 para 2026-01-01T00:00:00.000Z', async () => {
    const http = makeHttp([makeRawPedido({ C5_EMISSAO: '20260101' })])
    const [pedido] = await makeConnector(http).execute({})
    expect(pedido.dataEmissao.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  // ── buildQuery — parâmetros passados corretamente ────────

  it('passa numeroPedido como C5_NUM no query', async () => {
    const http = makeHttp([makeRawPedido()])
    await makeConnector(http).execute({ numeroPedido: '999' })
    expect(http.get).toHaveBeenCalledWith('/PEDIDO/', { params: { C5_NUM: '999' } })
  })

  it('passa clienteId como C5_CLIENTE no query', async () => {
    const http = makeHttp([])
    await makeConnector(http).execute({ clienteId: 'CLI999' })
    expect(http.get).toHaveBeenCalledWith('/PEDIDO/', { params: { C5_CLIENTE: 'CLI999' } })
  })

  it('passa dataInicio e dataFim no query', async () => {
    const http = makeHttp([])
    await makeConnector(http).execute({ dataInicio: '20260101', dataFim: '20260531' })
    expect(http.get).toHaveBeenCalledWith('/PEDIDO/', {
      params: { C5_EMISSAO_INI: '20260101', C5_EMISSAO_FIM: '20260531' },
    })
  })

  it('omite params ausentes do query', async () => {
    const http = makeHttp([])
    await makeConnector(http).execute({})
    expect(http.get).toHaveBeenCalledWith('/PEDIDO/', { params: {} })
  })

  // ── Outros erros HTTP ────────────────────────────────────

  it('lança UpstreamError PROTHEUS_UNAUTHORIZED em HTTP 401', async () => {
    const http = makeHttpError(401)
    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_UNAUTHORIZED' })
  })

  it('lança UpstreamError PROTHEUS_INTERNAL_ERROR em HTTP 500', async () => {
    const http = makeHttpError(500)
    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_INTERNAL_ERROR' })
  })

  it('lança UpstreamError PROTHEUS_UNKNOWN_ERROR em HTTP desconhecido', async () => {
    const http = makeHttpError(418)
    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_UNKNOWN_ERROR', httpStatus: 418 })
  })

  // ── Instância de UpstreamError ───────────────────────────

  it('erro HTTP resulta em instância de UpstreamError', async () => {
    const http = makeHttpError(503)
    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(UpstreamError)
  })

  // ── C5_EMISSAO com formato inválido → ZodError ───────────

  it('lança ZodError quando C5_EMISSAO não tem 8 dígitos', async () => {
    const http = makeHttp([makeRawPedido({ C5_EMISSAO: '2026-05-24' })])
    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  it('lança ZodError quando C5_EMISSAO tem letras', async () => {
    const http = makeHttp([makeRawPedido({ C5_EMISSAO: 'YYYYMMDD' })])
    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })
})
