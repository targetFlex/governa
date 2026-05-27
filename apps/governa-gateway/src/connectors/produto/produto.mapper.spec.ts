// ============================================================
// produto.mapper.spec.ts — Testes unitários do ProdutoMapper
// ============================================================

import { ProdutoMapper } from './produto.mapper'
import { ProtheusProdutoRaw } from './produto.schema'

describe('ProdutoMapper', () => {
  let mapper: ProdutoMapper

  beforeEach(() => {
    mapper = new ProdutoMapper()
  })

  // ── Fixture ────────────────────────────────────────────────

  const makeRaw = (overrides: Partial<ProtheusProdutoRaw> = {}): ProtheusProdutoRaw => ({
    B1_COD:    'PROD001',
    B1_DESC:   'Produto de Teste',
    B1_UM:     'UN',
    B1_TIPO:   'PA',
    B1_PRV1:   99.90,
    B1_LOCPAD: 'A-01-01',
    B1_MSBLQ:  '1',
    ...overrides,
  })

  // ── Campos de identidade ──────────────────────────────────

  it('mapeia campos de identidade corretamente', () => {
    const result = mapper.toInterno(makeRaw())
    expect(result.codigoProduto).toBe('PROD001')
    expect(result.descricao).toBe('Produto de Teste')
    expect(result.unidadeMedida).toBe('UN')
    expect(result.precoVenda).toBe(99.90)
  })

  // ── B1_TIPO → TipoProduto ─────────────────────────────────

  it('mapeia B1_TIPO PA → PRODUTO_ACABADO', () => {
    expect(mapper.toInterno(makeRaw({ B1_TIPO: 'PA' })).tipo).toBe('PRODUTO_ACABADO')
  })

  it('mapeia B1_TIPO MA → MATERIA_PRIMA', () => {
    expect(mapper.toInterno(makeRaw({ B1_TIPO: 'MA' })).tipo).toBe('MATERIA_PRIMA')
  })

  it('mapeia B1_TIPO ME → MERCADORIA', () => {
    expect(mapper.toInterno(makeRaw({ B1_TIPO: 'ME' })).tipo).toBe('MERCADORIA')
  })

  it('mapeia B1_TIPO SC → SERVICO', () => {
    expect(mapper.toInterno(makeRaw({ B1_TIPO: 'SC' })).tipo).toBe('SERVICO')
  })

  // ── B1_MSBLQ → bloqueado ──────────────────────────────────

  it("mapeia B1_MSBLQ '1' → bloqueado: false", () => {
    expect(mapper.toInterno(makeRaw({ B1_MSBLQ: '1' })).bloqueado).toBe(false)
  })

  it("mapeia B1_MSBLQ '2' → bloqueado: true", () => {
    expect(mapper.toInterno(makeRaw({ B1_MSBLQ: '2' })).bloqueado).toBe(true)
  })

  // ── B1_LOCPAD → localizacaoPadrao ────────────────────────

  it('mantém localização válida como string', () => {
    const result = mapper.toInterno(makeRaw({ B1_LOCPAD: 'B-02-03' }))
    expect(result.localizacaoPadrao).toBe('B-02-03')
  })

  it('converte B1_LOCPAD vazio ("") → null', () => {
    const result = mapper.toInterno(makeRaw({ B1_LOCPAD: '' }))
    expect(result.localizacaoPadrao).toBeNull()
  })

  it('converte B1_LOCPAD de somente espaços → null', () => {
    const result = mapper.toInterno(makeRaw({ B1_LOCPAD: '   ' }))
    expect(result.localizacaoPadrao).toBeNull()
  })

  it('converte B1_LOCPAD undefined (default) → null', () => {
    const raw = makeRaw()
    // @ts-ignore — simula Protheus sem o campo
    delete raw.B1_LOCPAD
    const result = mapper.toInterno({ ...raw, B1_LOCPAD: '' })
    expect(result.localizacaoPadrao).toBeNull()
  })

  it('faz trim de B1_LOCPAD com espaços nas bordas', () => {
    const result = mapper.toInterno(makeRaw({ B1_LOCPAD: '  C-01-05  ' }))
    expect(result.localizacaoPadrao).toBe('C-01-05')
  })

  // ── precoVenda ────────────────────────────────────────────

  it('mapeia preço zero sem erro (produto sem preço cadastrado)', () => {
    const result = mapper.toInterno(makeRaw({ B1_PRV1: 0 }))
    expect(result.precoVenda).toBe(0)
  })

  it('mapeia preço negativo sem erro (desconto especial)', () => {
    const result = mapper.toInterno(makeRaw({ B1_PRV1: -10.50 }))
    expect(result.precoVenda).toBe(-10.50)
  })

  // ── Integridade geral ─────────────────────────────────────

  it('produto completo é mapeado corretamente em todos os campos', () => {
    const result = mapper.toInterno(makeRaw({
      B1_COD:    'KG-500',
      B1_DESC:   'Aço Carbono 500g',
      B1_UM:     'KG',
      B1_TIPO:   'MA',
      B1_PRV1:   12.75,
      B1_LOCPAD: 'D-03-12',
      B1_MSBLQ:  '1',
    }))

    expect(result).toEqual({
      codigoProduto:     'KG-500',
      descricao:         'Aço Carbono 500g',
      unidadeMedida:     'KG',
      tipo:              'MATERIA_PRIMA',
      precoVenda:        12.75,
      localizacaoPadrao: 'D-03-12',
      bloqueado:         false,
    })
  })

  it('produto de serviço bloqueado sem localização é mapeado corretamente', () => {
    const result = mapper.toInterno(makeRaw({
      B1_TIPO:   'SC',
      B1_LOCPAD: '',
      B1_MSBLQ:  '2',
    }))

    expect(result.tipo).toBe('SERVICO')
    expect(result.localizacaoPadrao).toBeNull()
    expect(result.bloqueado).toBe(true)
  })
})
