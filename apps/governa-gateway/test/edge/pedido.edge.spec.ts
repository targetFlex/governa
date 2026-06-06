// ============================================================
// pedido.edge.spec.ts — Edge cases do conector read_protheus_pedido
//
// Cenários extremos que não devem passar silenciosamente.
// Separados dos testes unitários para rastreabilidade em CI.
// ============================================================

import { AxiosInstance } from 'axios'
import { ZodError } from 'zod'
import { ReadProtheusPedidoConnector } from '../../src/connectors/pedido/read-protheus-pedido.connector'
import { PedidoMapper } from '../../src/connectors/pedido/pedido.mapper'
import { UpstreamError } from '../../src/connectors/shared/upstream-error.handler'

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

function makeConnector(httpMock: any) {
  return new ReadProtheusPedidoConnector(httpMock as AxiosInstance, new PedidoMapper())
}

// ── Edge cases ─────────────────────────────────────────────

describe('read_protheus_pedido — edge cases', () => {
  // EC-1: lista vazia não é erro
  it('Protheus retorna lista vazia → retorna array vazio, sem erro', async () => {
    const http = { get: jest.fn().mockResolvedValue({ data: [] }) }
    const result = await makeConnector(http).execute({})
    expect(result).toEqual([])
    expect(Array.isArray(result)).toBe(true)
  })

  // EC-2: D2_QUANT = 0 é válido (item sem quantidade ainda é item)
  it('Protheus retorna item com D2_QUANT = 0 → mapeado sem erro', async () => {
    const pedido = makeRawPedido({
      C5_ITENS: [{ D2_COD: 'BRINDE', D2_QUANT: 0, D2_PRCVEN: 0 }],
    })
    const http = { get: jest.fn().mockResolvedValue({ data: [pedido] }) }
    const [result] = await makeConnector(http).execute({})
    expect(result.itens[0].quantidade).toBe(0)
    expect(result.itens[0].precoUnitario).toBe(0)
  })

  // EC-3: C5_VALOR negativo é válido (nota de crédito / devolução)
  it('C5_VALOR negativo → mapeado sem erro (nota de crédito)', async () => {
    const pedido = makeRawPedido({ C5_VALOR: -750.00 })
    const http = { get: jest.fn().mockResolvedValue({ data: [pedido] }) }
    const [result] = await makeConnector(http).execute({})
    expect(result.valorTotal).toBe(-750.00)
  })

  // EC-4: resposta mista (válida + inválida) → falha completa, não parcial
  it('resposta mista válida + inválida → falha completa (não parcial)', async () => {
    const valido   = makeRawPedido({ C5_NUM: '000001' })
    const invalido = makeRawPedido({ C5_STATUS: 'Z' })  // status fora do enum
    const http = {
      get: jest.fn().mockResolvedValue({ data: [valido, invalido] }),
    }

    await expect(makeConnector(http).execute({})).rejects.toBeInstanceOf(ZodError)
  })

  // EC-5: timeout Axios → UpstreamError com code PROTHEUS_TIMEOUT
  it('timeout Axios → UpstreamError com code PROTHEUS_TIMEOUT', async () => {
    const timeoutError: any = new Error('timeout of 10000ms exceeded')
    timeoutError.code = 'ECONNABORTED'
    const http = { get: jest.fn().mockRejectedValue(timeoutError) }

    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({
        name:   'UpstreamError',
        code:   'PROTHEUS_TIMEOUT',
        source: 'read_protheus_pedido',
      })
  })

  // EC-6: timeout via ERR_NETWORK também mapeia corretamente
  it('ERR_NETWORK → UpstreamError com code PROTHEUS_TIMEOUT', async () => {
    const networkError: any = new Error('Network Error')
    networkError.code = 'ERR_NETWORK'
    const http = { get: jest.fn().mockRejectedValue(networkError) }

    await expect(makeConnector(http).execute({}))
      .rejects.toMatchObject({ code: 'PROTHEUS_TIMEOUT' })
  })

  // EC-7: múltiplos pedidos na resposta mapeados independentemente
  it('Protheus retorna múltiplos pedidos → todos mapeados corretamente', async () => {
    const pedidos = [
      makeRawPedido({ C5_NUM: '000001', C5_STATUS: 'A' }),
      makeRawPedido({ C5_NUM: '000002', C5_STATUS: 'B' }),
      makeRawPedido({ C5_NUM: '000003', C5_STATUS: 'L' }),
    ]
    const http = { get: jest.fn().mockResolvedValue({ data: pedidos }) }
    const result = await makeConnector(http).execute({})

    expect(result).toHaveLength(3)
    expect(result[0].status).toBe('ABERTO')
    expect(result[1].status).toBe('BLOQUEADO')
    expect(result[2].status).toBe('LIBERADO')
  })

  // EC-8: envelope com items null → retorna array vazio
  it('envelope com items null → retorna array vazio sem erro', async () => {
    const http = { get: jest.fn().mockResolvedValue({ data: { items: null } }) }
    const result = await makeConnector(http).execute({})
    expect(result).toEqual([])
  })
})
