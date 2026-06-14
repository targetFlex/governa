/**
 * PiiDetector — gate síncrono que rejeita PII em campos livres
 * do AuditEvent (especialmente `inputSummary`).
 *
 * LGPD art. 6º (princípio da necessidade): só tratar o mínimo
 * necessário. O `inputSummary` é descrição da INTENÇÃO do agente,
 * não dos dados. Se PII vazar pra lá, é bug — bloqueamos a gravação.
 *
 * Padrões detectados (Brasil-first):
 *   - CPF: 11 dígitos com ou sem . / -
 *   - CNPJ: 14 dígitos com ou sem . / / / -
 *   - Email
 *   - Telefone BR (10 ou 11 dígitos, com ou sem DDD entre parênteses)
 *   - Cartão de crédito: 13-19 dígitos validados por Luhn
 *
 * Falsos positivos são preferíveis a falsos negativos (LGPD = risco
 * material). Em caso de bloqueio indevido, o caller reformula o
 * inputSummary — nunca relaxa o detector.
 */

export type PiiKind = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'CREDIT_CARD'

export interface PiiFinding {
  readonly kind:  PiiKind
  readonly match: string
}

/**
 * Padrões — exportados para teste/debug. Não modificar sem revisar
 * o suite completo de edge cases.
 */
const PATTERNS = {
  CPF:   /(?<![\d-])(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{2})(?![\d-])/g,
  CNPJ:  /(?<![\d-])(\d{2})[.\s-]?(\d{3})[.\s-]?(\d{3})[.\s-]?\/?\s?(\d{4})[.\s-]?(\d{2})(?![\d-])/g,
  EMAIL: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  PHONE: /(?<![\d])\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}(?![\d])/g,
  CARD:  /(?<![\d])(?:\d[\s-]?){12,18}\d(?![\d])/g,
} as const

export class PiiDetector {
  /**
   * Retorna todos os achados — útil para teste e debug.
   * Não dispara erro; quem decide o que fazer é o caller.
   */
  scan(text: string): readonly PiiFinding[] {
    if (!text) return []
    const findings: PiiFinding[] = []

    for (const m of text.matchAll(PATTERNS.CPF)) {
      const stripped = m[0].replace(/[^\d]/g, '')
      if (stripped.length === 11) {
        findings.push({ kind: 'CPF', match: m[0] })
      }
    }

    for (const m of text.matchAll(PATTERNS.CNPJ)) {
      const stripped = m[0].replace(/[^\d]/g, '')
      if (stripped.length === 14) {
        findings.push({ kind: 'CNPJ', match: m[0] })
      }
    }

    for (const m of text.matchAll(PATTERNS.EMAIL)) {
      findings.push({ kind: 'EMAIL', match: m[0] })
    }

    for (const m of text.matchAll(PATTERNS.PHONE)) {
      const stripped = m[0].replace(/[^\d]/g, '')
      // Evita double-match com CPF (11 dígitos sem separadores)
      // — telefone aceita 10 (fixo) ou 11 (celular)
      if (stripped.length === 10 || stripped.length === 11) {
        findings.push({ kind: 'PHONE', match: m[0] })
      }
    }

    for (const m of text.matchAll(PATTERNS.CARD)) {
      const stripped = m[0].replace(/[^\d]/g, '')
      if (stripped.length >= 13 && stripped.length <= 19 && isLuhnValid(stripped)) {
        findings.push({ kind: 'CREDIT_CARD', match: m[0] })
      }
    }

    return findings
  }

  /**
   * Assert clean — lança PiiDetectedError se houver QUALQUER achado.
   * Use no service antes de gravar evento de auditoria.
   */
  assertClean(text: string, context = 'inputSummary'): void {
    const findings = this.scan(text)
    if (findings.length > 0) {
      throw new PiiDetectedError(context, findings)
    }
  }
}

export class PiiDetectedError extends Error {
  readonly code = 'PII_DETECTED'

  constructor(
    readonly context:  string,
    readonly findings: readonly PiiFinding[],
  ) {
    const kinds = [...new Set(findings.map(f => f.kind))].join(', ')
    super(`PII detected in ${context}: ${kinds}`)
    this.name = 'PiiDetectedError'
  }
}

/**
 * Algoritmo de Luhn — validação de checksum para cartão de crédito.
 * Reduz falsos positivos: 16 dígitos quaisquer não passam por aqui.
 */
function isLuhnValid(digits: string): boolean {
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (d < 0 || d > 9) return false
    if (alt) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    alt = !alt
  }
  return sum % 10 === 0
}
