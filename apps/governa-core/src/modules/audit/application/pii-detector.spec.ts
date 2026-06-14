import { PiiDetector, PiiDetectedError } from './pii-detector'

const detector = new PiiDetector()

describe('PiiDetector', () => {
  // ---------------------------------------------------------------------------
  // scan — CPF
  // ---------------------------------------------------------------------------
  describe('Given a text with CPF', () => {
    it('When CPF is formatted (000.000.000-00), Then it is detected', () => {
      const findings = detector.scan('Cliente: 123.456.789-09')
      expect(findings).toHaveLength(1)
      expect(findings[0].kind).toBe('CPF')
    })

    it('When CPF is unformatted (11 digits), Then it is detected', () => {
      const findings = detector.scan('cpf 12345678909')
      expect(findings.some(f => f.kind === 'CPF')).toBe(true)
    })

    it('When number has 10 digits only, Then CPF is NOT detected', () => {
      const findings = detector.scan('1234567890')
      expect(findings.some(f => f.kind === 'CPF')).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // scan — CNPJ
  // ---------------------------------------------------------------------------
  describe('Given a text with CNPJ', () => {
    it('When CNPJ is formatted (00.000.000/0000-00), Then it is detected', () => {
      const findings = detector.scan('CNPJ: 12.345.678/0001-95')
      expect(findings.some(f => f.kind === 'CNPJ')).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // scan — Email
  // ---------------------------------------------------------------------------
  describe('Given a text with email', () => {
    it('When a valid email is present, Then it is detected', () => {
      const findings = detector.scan('Contato: usuario@empresa.com.br')
      expect(findings).toHaveLength(1)
      expect(findings[0].kind).toBe('EMAIL')
    })

    it('When text has no @, Then email is NOT detected', () => {
      const findings = detector.scan('Agente consultou pedido numero 42')
      expect(findings.some(f => f.kind === 'EMAIL')).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // scan — Telefone
  // ---------------------------------------------------------------------------
  describe('Given a text with phone number', () => {
    it('When BR mobile (11 digits with DDD) is present, Then it is detected', () => {
      const findings = detector.scan('Fone: 11987654321')
      expect(findings.some(f => f.kind === 'PHONE')).toBe(true)
    })

    it('When BR landline (10 digits) is present, Then it is detected', () => {
      const findings = detector.scan('Fone: 1132981234')
      expect(findings.some(f => f.kind === 'PHONE')).toBe(true)
    })

    it('When formatted (11) 98765-4321 is present, Then it is detected', () => {
      const findings = detector.scan('(11) 98765-4321')
      expect(findings.some(f => f.kind === 'PHONE')).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // scan — Cartão de crédito (Luhn)
  // ---------------------------------------------------------------------------
  describe('Given a text with credit card', () => {
    it('When Luhn-valid 16-digit number is present, Then CREDIT_CARD is detected', () => {
      // 4111111111111111 é número de teste Visa (Luhn válido)
      const findings = detector.scan('Cartão: 4111111111111111')
      expect(findings.some(f => f.kind === 'CREDIT_CARD')).toBe(true)
    })

    it('When 16-digit number fails Luhn, Then CREDIT_CARD is NOT detected', () => {
      const findings = detector.scan('Numero: 1234567890123456')
      expect(findings.some(f => f.kind === 'CREDIT_CARD')).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // scan — texto limpo
  // ---------------------------------------------------------------------------
  describe('Given a clean text', () => {
    it('When no PII is present, Then scan returns empty array', () => {
      const findings = detector.scan('Agente consultou status do pedido #42 com sucesso')
      expect(findings).toHaveLength(0)
    })

    it('When text is empty, Then scan returns empty array', () => {
      expect(detector.scan('')).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // assertClean
  // ---------------------------------------------------------------------------
  describe('assertClean', () => {
    it('When text is clean, Then does not throw', () => {
      expect(() => detector.assertClean('Status: pedido aprovado')).not.toThrow()
    })

    it('When text contains CPF, Then throws PiiDetectedError', () => {
      expect(() => detector.assertClean('CPF: 123.456.789-09'))
        .toThrow(PiiDetectedError)
    })

    it('When PiiDetectedError is thrown, Then code is PII_DETECTED', () => {
      try {
        detector.assertClean('email: user@test.com')
        fail('expected throw')
      } catch (err) {
        expect(err).toBeInstanceOf(PiiDetectedError)
        expect((err as PiiDetectedError).code).toBe('PII_DETECTED')
        expect((err as PiiDetectedError).findings.length).toBeGreaterThan(0)
      }
    })

    it('When context is provided, Then error message includes it', () => {
      expect(() => detector.assertClean('user@test.com', 'myField'))
        .toThrow(/myField/)
    })
  })
})
