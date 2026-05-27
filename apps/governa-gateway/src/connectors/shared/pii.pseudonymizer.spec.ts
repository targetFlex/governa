import { createHmac } from 'crypto'
import { PiiPseudonymizer } from './pii.pseudonymizer'

// ── Fixtures ───────────────────────────────────────────────

const SECRET_A = 'chave-teste-a-256bits-xxxxxxxxxxxx'
const SECRET_B = 'chave-teste-b-256bits-xxxxxxxxxxxx'

function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

// ── Testes ─────────────────────────────────────────────────

describe('PiiPseudonymizer', () => {
  let pseudonymizer: PiiPseudonymizer

  beforeEach(() => {
    pseudonymizer = new PiiPseudonymizer(SECRET_A)
  })

  // ── Construção ───────────────────────────────────────────

  it('instancia corretamente com chave válida', () => {
    expect(() => new PiiPseudonymizer(SECRET_A)).not.toThrow()
  })

  it('lança erro ao instanciar com chave vazia', () => {
    expect(() => new PiiPseudonymizer('')).toThrow('secretKey não pode ser vazia')
  })

  it('lança erro ao instanciar com chave de espaços', () => {
    expect(() => new PiiPseudonymizer('   ')).toThrow('secretKey não pode ser vazia')
  })

  // ── pseudonymize ─────────────────────────────────────────

  it('retorna string hexadecimal de 64 caracteres (SHA-256)', () => {
    const result = pseudonymizer.pseudonymize('12345678000195')
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })

  it('é determinístico: mesma entrada + mesma chave → mesmo hash', () => {
    const valor = '12345678000195'
    expect(pseudonymizer.pseudonymize(valor)).toBe(pseudonymizer.pseudonymize(valor))
  })

  it('produz hash correto (verificação com crypto direto)', () => {
    const valor = '12345678000195'
    const esperado = hmac(SECRET_A, valor)
    expect(pseudonymizer.pseudonymize(valor)).toBe(esperado)
  })

  it('entradas diferentes → hashes diferentes', () => {
    const h1 = pseudonymizer.pseudonymize('11122233344')
    const h2 = pseudonymizer.pseudonymize('55566677788')
    expect(h1).not.toBe(h2)
  })

  it('chaves diferentes → hashes diferentes para mesma entrada', () => {
    const valor = 'usuario@empresa.com.br'
    const pA = new PiiPseudonymizer(SECRET_A).pseudonymize(valor)
    const pB = new PiiPseudonymizer(SECRET_B).pseudonymize(valor)
    expect(pA).not.toBe(pB)
  })

  it('pseudonimiza e-mail corretamente', () => {
    const email = 'joao.silva@empresa.com.br'
    expect(pseudonymizer.pseudonymize(email)).toBe(hmac(SECRET_A, email))
  })

  it('pseudonimiza telefone corretamente', () => {
    const tel = '11999887766'
    expect(pseudonymizer.pseudonymize(tel)).toBe(hmac(SECRET_A, tel))
  })

  // ── pseudonymizeIfPresent ────────────────────────────────

  it('retorna null para null', () => {
    expect(pseudonymizer.pseudonymizeIfPresent(null)).toBeNull()
  })

  it('retorna null para undefined', () => {
    expect(pseudonymizer.pseudonymizeIfPresent(undefined)).toBeNull()
  })

  it('retorna null para string vazia', () => {
    expect(pseudonymizer.pseudonymizeIfPresent('')).toBeNull()
  })

  it('retorna null para string somente com espaços', () => {
    expect(pseudonymizer.pseudonymizeIfPresent('   ')).toBeNull()
  })

  it('retorna hash para valor presente', () => {
    const valor = '12345678000195'
    const result = pseudonymizer.pseudonymizeIfPresent(valor)
    expect(result).toBe(hmac(SECRET_A, valor))
  })

  it('pseudonymizeIfPresent é consistente com pseudonymize para valores válidos', () => {
    const valor = 'teste@dominio.com'
    expect(pseudonymizer.pseudonymizeIfPresent(valor))
      .toBe(pseudonymizer.pseudonymize(valor))
  })
})
