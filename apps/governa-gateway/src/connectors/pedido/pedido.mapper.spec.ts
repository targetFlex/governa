import { PedidoMapper } from './pedido.mapper'
import { ProtheusPedidoRaw } from './pedido.schema'

describe('PedidoMapper', () => {
  let mapper: PedidoMapper

  beforeEach(() => {
    mapper = new PedidoMapper()
  })

  // ── Fixture ────────────────────────────────────────────────

  const makeRaw = (overrides: Partial<ProtheusPedidoRaw> = {}): ProtheusPedidoRaw => ({
    C5_NUM:     '000001',
    C5_CLIENTE: 'CLI001',
    C5_LOJA:    '01',
    C5_EMISSAO: '20260524',
    C5_VALOR:   1500.00,
    C5_STATUS:  'A',
    C5_ITENS:   [{ D2_COD: 'PROD01', D2_QUANT: 2, D2_PRCVEN: 750.00 }],
    ...overrides,
  })

  // ── Campos básicos ────────────────────────────────────────

  it('mapeia campos de identidade corretamente', () => {
    const result = mapper.toInterno(makeRaw())
    expect(result.numeroPedido).toBe('000001')
    expect(result.clienteId).toBe('CLI001')
    expect(result.loja).toBe('01')
    expect(result.valorTotal).toBe(1500.00)
  })

  // ── dataEmissao ───────────────────────────────────────────

  it('converte C5_EMISSAO YYYYMMDD para Date UTC corretamente', () => {
    const result = mapper.toInterno(makeRaw({ C5_EMISSAO: '20260524' }))
    expect(result.dataEmissao).toBeInstanceOf(Date)
    expect(result.dataEmissao.toISOString()).toBe('2026-05-24T00:00:00.000Z')
  })

  it('converte C5_EMISSAO de início de mês corretamente', () => {
    const result = mapper.toInterno(makeRaw({ C5_EMISSAO: '20260101' }))
    expect(result.dataEmissao.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('converte C5_EMISSAO de final de ano corretamente', () => {
    const result = mapper.toInterno(makeRaw({ C5_EMISSAO: '20251231' }))
    expect(result.dataEmissao.toISOString()).toBe('2025-12-31T00:00:00.000Z')
  })

  // ── status ────────────────────────────────────────────────

  it('mapeia C5_STATUS A → ABERTO', () => {
    expect(mapper.toInterno(makeRaw({ C5_STATUS: 'A' })).status).toBe('ABERTO')
  })

  it('mapeia C5_STATUS B → BLOQUEADO', () => {
    expect(mapper.toInterno(makeRaw({ C5_STATUS: 'B' })).status).toBe('BLOQUEADO')
  })

  it('mapeia C5_STATUS E → ENCERRADO', () => {
    expect(mapper.toInterno(makeRaw({ C5_STATUS: 'E' })).status).toBe('ENCERRADO')
  })

  it('mapeia C5_STATUS L → LIBERADO', () => {
    expect(mapper.toInterno(makeRaw({ C5_STATUS: 'L' })).status).toBe('LIBERADO')
  })

  // ── itens ─────────────────────────────────────────────────

  it('mapeia itens corretamente', () => {
    const result = mapper.toInterno(makeRaw({
      C5_ITENS: [
        { D2_COD: 'A001', D2_QUANT: 3, D2_PRCVEN: 100.00 },
        { D2_COD: 'B002', D2_QUANT: 1, D2_PRCVEN: 250.50 },
      ],
    }))
    expect(result.itens).toHaveLength(2)
    expect(result.itens[0]).toEqual({ codigoProduto: 'A001', quantidade: 3, precoUnitario: 100.00 })
    expect(result.itens[1]).toEqual({ codigoProduto: 'B002', quantidade: 1, precoUnitario: 250.50 })
  })

  it('mapeia pedido sem itens (lista vazia)', () => {
    const result = mapper.toInterno(makeRaw({ C5_ITENS: [] }))
    expect(result.itens).toEqual([])
  })

  it('mapeia item com D2_QUANT = 0 sem erro', () => {
    const result = mapper.toInterno(makeRaw({
      C5_ITENS: [{ D2_COD: 'X', D2_QUANT: 0, D2_PRCVEN: 50 }],
    }))
    expect(result.itens[0].quantidade).toBe(0)
  })

  it('mapeia C5_VALOR negativo sem erro (nota de crédito)', () => {
    const result = mapper.toInterno(makeRaw({ C5_VALOR: -500 }))
    expect(result.valorTotal).toBe(-500)
  })
})
