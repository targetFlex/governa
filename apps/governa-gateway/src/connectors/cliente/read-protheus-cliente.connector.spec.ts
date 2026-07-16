import { AxiosInstance } from 'axios'
import { ZodError } from 'zod'
import { ReadProtheusCilenteConnector, ReadClienteParams } from './read-protheus-cliente.connector'
import { ClienteMapper } from './cliente.mapper'
import { PiiPseudonymizer } from '../shared/pii.pseudonymizer'
import { UpstreamError } from '../shared/upstream-error.handler'

// ── Helpers ────────────────────────────────────────────────

const TEST_SECRET = 'secret-connector-spec-32bytes-xx'

function makeRawCliente(overrides: Record<string, unknown> = {}) {
  return {
    A1_COD:   'CLI001',
    A1_LOJA:  '01',
    A1_NOME:  'Empresa Teste LTDA',
    A1_END:   'Av. Paulista, 1000',
    A1_MUN:   'São Paulo',
    A1_EST:   'SP',
    A1_CEP:   '01310100',
    A1_CGC:   '12345678000195',
    A1_EMAIL: 'contato@empresa.com.br',
    A1_TEL:   '11999887766',
    A1_TIPO:  'J',
    A1_ATIVO: 'S',
    ...overrides,
  }
}

function makeHttp(data: unknown, status = 200): jest.Mocked<Pick<AxiosInstance, 'get'>> {
  return { get: jest.fn().mockResolvedValue({ data, status }) } as any
}

function makeHttpError(httpStatus: number) {
  const err: any = new Error(`HTTP ${httpStatus}`)
  err.response = { status: httpStatus, data: {} }
  return { get: jest.fn().mockRejectedValue(err) } as any
}

function makeConnector(http: any) {
  const mapper = new ClienteMapper(new PiiPseudonymizer(TEST_SECRET))
  return new ReadProtheusCilenteConnector(http as AxiosInstance, mapper)
}

// ── Testes ─────────────────────────────────────────────────

describe('ReadProtheusCilenteConnector', () => {
  // ── Critério 1: resposta válida → ClienteInterno[] ────────

  it('retorna ClienteInterno[] para resposta válida em array direto', async () => {
    const http = makeHttp([makeRawCliente()])
    const result = await makeConnector(http).execute({})

    expect(result).toHaveLength(1)
    expect(result[0].codigoCliente).toBe('CLI001')
    expect(result[0].loja).toBe('01')
    expect(result[0].nomePseudo).toMatch(/^[0-9a-f]{64}$/)
    expect(result[0].tipo).toBe('JURIDICA')
    expect(result[0].ativo).toBe(true)
  })

  it('retorna ClienteInterno[] para resposta em envelope { items: [...] }', async () => {
    const http = makeHttp({ items: [makeRawCliente()] })
    const result = await makeConnector(http).execute({})
    expect(result).toHaveLength(1)
    expect(result[0].codigoCliente).toBe('CLI001')
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

  // ── Critério 2: PII pseudonimizado — nunca expõe valor real ─

  it('documentoPseudo não contém o CNPJ/CPF original', async () => {
    const cgc = '12345678000195'
    const http = makeHttp([makeRawCliente({ A1_CGC: cgc })])
    const [result] = await makeConnector(http).execute({})

    expect(result.documentoPseudo).not.toBe(cgc)
    expect(result.documentoPseudo).toMatch(/^[0-9a-f]{64}$/)
  })

  it('emailPseudo não contém o e-mail original', async () => {
    const email = 'usuario@dominio.com.br'
    const http = makeHttp([makeRawCliente({ A1_EMAIL: email })])
    const [result] = await makeConnector(http).execute({})

    expect(result.emailPseudo).not.toBe(email)
    expect(result.emailPseudo).toMatch(/^[0-9a-f]{64}$/)
  })

  it('telefonePseudo não contém o telefone original', async () => {
    const tel = '11999887766'
    const http = makeHttp([makeRawCliente({ A1_TEL: tel })])
    const [result] = await makeConnector(http).execute({})

    expect(result.telefonePseudo).not.toBe(tel)
    expect(result.telefonePseudo).toMatch(/^[0-9a-f]{64}$/)
  })

  it('emailPseudo é null quando e-mail está vazio', async () => {
    const http = makeHttp([makeRawCliente({ A1_EMAIL: '' })])
    const [result] = await makeConnector(http).execute({})
    expect(result.emailPseudo).toBeNull()
  })

  it('telefonePseudo é null quando telefone está vazio', async () => {
    const http = makeHttp([makeRawCliente({ A1_TEL: '' })])
    const [result] = await makeConnector(http).execute({})
    expect(result.telefonePseudo).toBeNull()
  })

  // ── Critério 3: campo ausente → ZodError ──────────────────

  it('lança ZodError quando A1_COD está ausente', async () => {
    const raw = makeRawCliente()
    delete (raw as any).A1_COD
    await expect(makeConnector(makeHttp([raw])).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  it('lança ZodError quando A1_CGC está ausente', async () => {
    const raw = makeRawCliente()
    delete (raw as any).A1_CGC
    await expect(makeConnector(makeHttp([raw])).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  it('lança ZodError quando A1_TIPO tem valor fora do enum', async () => {
    await expect(
      makeConnector(makeHttp([makeRawCliente({ A1_TIPO: 'X' })])).execute({})
    ).rejects.toBeInstanceOf(ZodError)
  })

  it('lança ZodError quando A1_ATIVO tem valor fora do enum', async () => {
    await expect(
      makeConnector(makeHttp([makeRawCliente({ A1_ATIVO: 'Y' })])).execute({})
    ).rejects.toBeInstanceOf(ZodError)
  })

  it('lança ZodError quando A1_CEP não tem 8 dígitos', async () => {
    await expect(
      makeConnector(makeHttp([makeRawCliente({ A1_CEP: '01310-100' })])).execute({})
    ).rejects.toBeInstanceOf(ZodError)
  })

  // ── Critério 4: erros HTTP → UpstreamError mapeado ────────

  it('lança UpstreamError PROTHEUS_NOT_FOUND em HTTP 404', async () => {
    await expect(makeConnector(makeHttpError(404)).execute({}))
      .rejects.toMatchObject({
        name:       'UpstreamError',
        code:       'PROTHEUS_NOT_FOUND',
        httpStatus: 404,
        source:     'read_protheus_cliente',
      })
  })

  it('lança UpstreamError PROTHEUS_RATE_LIMITED em HTTP 429', async () => {
    await expect(makeConnector(makeHttpError(429)).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_RATE_LIMITED', httpStatus: 429 })
  })

  it('lança UpstreamError PROTHEUS_UNAUTHORIZED em HTTP 401', async () => {
    await expect(makeConnector(makeHttpError(401)).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_UNAUTHORIZED' })
  })

  it('lança UpstreamError PROTHEUS_INTERNAL_ERROR em HTTP 500', async () => {
    await expect(makeConnector(makeHttpError(500)).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_INTERNAL_ERROR' })
  })

  it('lança UpstreamError PROTHEUS_UNKNOWN_ERROR em HTTP desconhecido', async () => {
    await expect(makeConnector(makeHttpError(418)).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_UNKNOWN_ERROR', httpStatus: 418 })
  })

  it('erro HTTP resulta em instância de UpstreamError', async () => {
    await expect(makeConnector(makeHttpError(503)).execute({})).rejects.toBeInstanceOf(UpstreamError)
  })

  // ── Critério 5: buildQuery — parâmetros passados corretamente

  it('passa codigoCliente como A1_COD no query', async () => {
    const http = makeHttp([])
    await makeConnector(http).execute({ codigoCliente: 'CLI999' })
    expect(http.get).toHaveBeenCalledWith('/CLIENTE/', { params: { A1_COD: 'CLI999' } })
  })

  it('passa loja como A1_LOJA no query', async () => {
    const http = makeHttp([])
    await makeConnector(http).execute({ loja: '02' })
    expect(http.get).toHaveBeenCalledWith('/CLIENTE/', { params: { A1_LOJA: '02' } })
  })

  it('passa cgc como A1_CGC no query', async () => {
    const http = makeHttp([])
    await makeConnector(http).execute({ cgc: '12345678000195' })
    expect(http.get).toHaveBeenCalledWith('/CLIENTE/', { params: { A1_CGC: '12345678000195' } })
  })

  it('passa ativo como A1_ATIVO no query', async () => {
    const http = makeHttp([])
    await makeConnector(http).execute({ ativo: 'S' })
    expect(http.get).toHaveBeenCalledWith('/CLIENTE/', { params: { A1_ATIVO: 'S' } })
  })

  it('omite params ausentes do query', async () => {
    const http = makeHttp([])
    await makeConnector(http).execute({})
    expect(http.get).toHaveBeenCalledWith('/CLIENTE/', { params: {} })
  })

  // ── Critério 6: endereco pseudonimizado no ClienteInterno ────

  it('pseudonimiza endereço completo no ClienteInterno', async () => {
    const http = makeHttp([makeRawCliente()])
    const [result] = await makeConnector(http).execute({})
    expect(result.enderecoPseudo).toMatch(/^[0-9a-f]{64}$/)
  })
})
