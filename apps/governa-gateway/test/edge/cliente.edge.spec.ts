// ============================================================
// cliente.edge.spec.ts — Edge cases do conector read_protheus_cliente
//
// Cenários extremos que não devem passar silenciosamente.
// Separados dos testes unitários para rastreabilidade em CI.
// ============================================================

import { AxiosInstance } from 'axios'
import { ZodError } from 'zod'
import { ReadProtheusCilenteConnector } from '../../src/connectors/cliente/read-protheus-cliente.connector'
import { ClienteMapper } from '../../src/connectors/cliente/cliente.mapper'
import { PiiPseudonymizer } from '../../src/connectors/shared/pii.pseudonymizer'
import { UpstreamError } from '../../src/connectors/shared/upstream-error.handler'

// ── Helpers ────────────────────────────────────────────────

const EDGE_SECRET = 'edge-test-secret-32bytes-xxxxxxx'

function makeRawCliente(overrides: Record<string, unknown> = {}) {
  return {
    A1_COD:   'CLI001',
    A1_LOJA:  '01',
    A1_NOME:  'Empresa Edge LTDA',
    A1_END:   'Rua Teste, 99',
    A1_MUN:   'Campinas',
    A1_EST:   'SP',
    A1_CEP:   '13010000',
    A1_CGC:   '12345678000195',
    A1_EMAIL: 'edge@teste.com.br',
    A1_TEL:   '19999998888',
    A1_TIPO:  'J',
    A1_ATIVO: 'S',
    ...overrides,
  }
}

function makeConnector(httpMock: any) {
  const mapper = new ClienteMapper(new PiiPseudonymizer(EDGE_SECRET))
  return new ReadProtheusCilenteConnector(httpMock as AxiosInstance, mapper)
}

// ── Edge cases ─────────────────────────────────────────────

describe('read_protheus_cliente — edge cases', () => {

  // EC-1: lista vazia não é erro
  it('Protheus retorna lista vazia → retorna array vazio, sem erro', async () => {
    const http = { get: jest.fn().mockResolvedValue({ data: [] }) }
    const result = await makeConnector(http).execute({})
    expect(result).toEqual([])
    expect(Array.isArray(result)).toBe(true)
  })

  // EC-2: A1_CGC obrigatório — ausente lança ZodError
  it('A1_CGC ausente → lança ZodError (PII obrigatório)', async () => {
    const raw = makeRawCliente()
    delete (raw as any).A1_CGC
    const http = { get: jest.fn().mockResolvedValue({ data: [raw] }) }
    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  // EC-3: A1_EMAIL ausente → emailPseudo null (campo opcional)
  it('A1_EMAIL ausente no raw → emailPseudo null (não lança erro)', async () => {
    const raw = makeRawCliente({ A1_EMAIL: '' })
    const http = { get: jest.fn().mockResolvedValue({ data: [raw] }) }
    const [result] = await makeConnector(http).execute({})
    expect(result.emailPseudo).toBeNull()
  })

  // EC-4: A1_TEL ausente → telefonePseudo null (campo opcional)
  it('A1_TEL ausente no raw → telefonePseudo null (não lança erro)', async () => {
    const raw = makeRawCliente({ A1_TEL: '' })
    const http = { get: jest.fn().mockResolvedValue({ data: [raw] }) }
    const [result] = await makeConnector(http).execute({})
    expect(result.telefonePseudo).toBeNull()
  })

  // EC-5: resposta mista (válida + inválida) → falha completa
  it('resposta mista válida + inválida → falha completa (não parcial)', async () => {
    const valido   = makeRawCliente({ A1_COD: 'CLI001' })
    const invalido = makeRawCliente({ A1_TIPO: 'X' }) // enum inválido
    const http = { get: jest.fn().mockResolvedValue({ data: [valido, invalido] }) }
    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  // EC-6: timeout Axios (ECONNABORTED) → UpstreamError PROTHEUS_TIMEOUT
  it('timeout Axios (ECONNABORTED) → UpstreamError PROTHEUS_TIMEOUT', async () => {
    const err: any = new Error('timeout of 10000ms exceeded')
    err.code = 'ECONNABORTED'
    const http = { get: jest.fn().mockRejectedValue(err) }
    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({
        name:   'UpstreamError',
        code:   'PROTHEUS_TIMEOUT',
        source: 'read_protheus_cliente',
      })
  })

  // EC-7: timeout de rede (ERR_NETWORK) → também PROTHEUS_TIMEOUT
  it('ERR_NETWORK → UpstreamError PROTHEUS_TIMEOUT', async () => {
    const err: any = new Error('Network Error')
    err.code = 'ERR_NETWORK'
    const http = { get: jest.fn().mockRejectedValue(err) }
    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_TIMEOUT' })
  })

  // EC-8: múltiplos clientes na resposta — mapeados independentemente
  it('múltiplos clientes → todos mapeados e pseudonimizados corretamente', async () => {
    const clientes = [
      makeRawCliente({ A1_COD: 'CLI001', A1_TIPO: 'J', A1_ATIVO: 'S' }),
      makeRawCliente({ A1_COD: 'CLI002', A1_TIPO: 'F', A1_ATIVO: 'N' }),
      makeRawCliente({ A1_COD: 'CLI003', A1_TIPO: 'J', A1_ATIVO: 'S' }),
    ]
    const http = { get: jest.fn().mockResolvedValue({ data: clientes }) }
    const result = await makeConnector(http).execute({})

    expect(result).toHaveLength(3)
    expect(result[0].codigoCliente).toBe('CLI001')
    expect(result[0].tipo).toBe('JURIDICA')
    expect(result[0].ativo).toBe(true)
    expect(result[1].codigoCliente).toBe('CLI002')
    expect(result[1].tipo).toBe('FISICA')
    expect(result[1].ativo).toBe(false)
    expect(result[2].codigoCliente).toBe('CLI003')

    // Todos devem ter documentoPseudo como hash hex
    result.forEach((c) => {
      expect(c.documentoPseudo).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  // EC-9: envelope com items null → retorna array vazio sem erro
  it('envelope com items null → retorna array vazio sem erro', async () => {
    const http = { get: jest.fn().mockResolvedValue({ data: { items: null } }) }
    const result = await makeConnector(http).execute({})
    expect(result).toEqual([])
  })

  // EC-10: cliente inativo (A1_ATIVO = N) não é descartado — retorna com ativo: false
  it('cliente inativo (A1_ATIVO N) → retornado com ativo: false', async () => {
    const raw = makeRawCliente({ A1_ATIVO: 'N' })
    const http = { get: jest.fn().mockResolvedValue({ data: [raw] }) }
    const [result] = await makeConnector(http).execute({})
    expect(result.ativo).toBe(false)
  })
})
