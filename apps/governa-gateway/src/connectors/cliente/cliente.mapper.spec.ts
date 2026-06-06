import { createHmac } from 'crypto'
import { ClienteMapper } from './cliente.mapper'
import { PiiPseudonymizer } from '../shared/pii.pseudonymizer'
import { ProtheusCilenteRaw } from './cliente.schema'

// ── Fixtures ───────────────────────────────────────────────

const SECRET = 'test-secret-mapper-32bytes-xxxxxx'

function hmac(value: string): string {
  return createHmac('sha256', SECRET).update(value).digest('hex')
}

const makeRaw = (overrides: Partial<ProtheusCilenteRaw> = {}): ProtheusCilenteRaw => ({
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
})

// ── Testes ─────────────────────────────────────────────────

describe('ClienteMapper', () => {
  let mapper: ClienteMapper
  let pseudonymizer: PiiPseudonymizer

  beforeEach(() => {
    pseudonymizer = new PiiPseudonymizer(SECRET)
    mapper = new ClienteMapper(pseudonymizer)
  })

  // ── Campos de identidade ─────────────────────────────────

  it('mapeia campos de identidade corretamente', () => {
    const result = mapper.toInterno(makeRaw())
    expect(result.codigoCliente).toBe('CLI001')
    expect(result.loja).toBe('01')
    expect(result.nome).toBe('Empresa Teste LTDA')
  })

  // ── tipo ─────────────────────────────────────────────────

  it('mapeia A1_TIPO J → JURIDICA', () => {
    expect(mapper.toInterno(makeRaw({ A1_TIPO: 'J' })).tipo).toBe('JURIDICA')
  })

  it('mapeia A1_TIPO F → FISICA', () => {
    expect(mapper.toInterno(makeRaw({ A1_TIPO: 'F' })).tipo).toBe('FISICA')
  })

  // ── ativo ─────────────────────────────────────────────────

  it('mapeia A1_ATIVO S → true', () => {
    expect(mapper.toInterno(makeRaw({ A1_ATIVO: 'S' })).ativo).toBe(true)
  })

  it('mapeia A1_ATIVO N → false', () => {
    expect(mapper.toInterno(makeRaw({ A1_ATIVO: 'N' })).ativo).toBe(false)
  })

  // ── PII — documentoPseudo ────────────────────────────────

  it('pseudonimiza A1_CGC com HMAC SHA-256', () => {
    const result = mapper.toInterno(makeRaw({ A1_CGC: '12345678000195' }))
    expect(result.documentoPseudo).toBe(hmac('12345678000195'))
  })

  it('documentoPseudo é string hexadecimal de 64 caracteres', () => {
    const result = mapper.toInterno(makeRaw())
    expect(result.documentoPseudo).toMatch(/^[0-9a-f]{64}$/)
  })

  it('documentoPseudo é determinístico', () => {
    const cgc = '99988877700011'
    const r1 = mapper.toInterno(makeRaw({ A1_CGC: cgc }))
    const r2 = mapper.toInterno(makeRaw({ A1_CGC: cgc }))
    expect(r1.documentoPseudo).toBe(r2.documentoPseudo)
  })

  it('CGCs diferentes → documentoPseudo diferentes', () => {
    const r1 = mapper.toInterno(makeRaw({ A1_CGC: '11122233344' }))
    const r2 = mapper.toInterno(makeRaw({ A1_CGC: '55566677788' }))
    expect(r1.documentoPseudo).not.toBe(r2.documentoPseudo)
  })

  // ── PII — emailPseudo ────────────────────────────────────

  it('pseudonimiza A1_EMAIL com HMAC SHA-256', () => {
    const result = mapper.toInterno(makeRaw({ A1_EMAIL: 'contato@empresa.com.br' }))
    expect(result.emailPseudo).toBe(hmac('contato@empresa.com.br'))
  })

  it('emailPseudo é null para e-mail ausente (string vazia)', () => {
    const result = mapper.toInterno(makeRaw({ A1_EMAIL: '' }))
    expect(result.emailPseudo).toBeNull()
  })

  it('emailPseudo é null quando A1_EMAIL não informado (default vazio)', () => {
    const raw = makeRaw()
    delete (raw as any).A1_EMAIL
    // Após parse Zod, A1_EMAIL terá default ''; mapper recebe string vazia
    const result = mapper.toInterno({ ...raw, A1_EMAIL: '' })
    expect(result.emailPseudo).toBeNull()
  })

  // ── PII — telefonePseudo ─────────────────────────────────

  it('pseudonimiza A1_TEL com HMAC SHA-256', () => {
    const result = mapper.toInterno(makeRaw({ A1_TEL: '11999887766' }))
    expect(result.telefonePseudo).toBe(hmac('11999887766'))
  })

  it('telefonePseudo é null para telefone vazio', () => {
    const result = mapper.toInterno(makeRaw({ A1_TEL: '' }))
    expect(result.telefonePseudo).toBeNull()
  })

  // ── endereco ─────────────────────────────────────────────

  it('mapeia endereço completo corretamente', () => {
    const result = mapper.toInterno(makeRaw())
    expect(result.endereco).toEqual({
      logradouro: 'Av. Paulista, 1000',
      municipio:  'São Paulo',
      estado:     'SP',
      cep:        '01310100',
    })
  })

  it('mapeia CEP com zeros à esquerda sem truncar', () => {
    const result = mapper.toInterno(makeRaw({ A1_CEP: '01001001' }))
    expect(result.endereco.cep).toBe('01001001')
  })
})
