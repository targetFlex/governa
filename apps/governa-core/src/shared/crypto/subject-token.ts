import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * SubjectTokenHasher — pseudonimiza identificador do titular via HMAC-SHA256.
 *
 * Razão (LGPD art. 12, §1º): o subject_token NÃO pode ser identificador
 * direto do titular (CPF, email, ID interno). Aplicamos HMAC com chave
 * secreta (`PII_HMAC_KEY`) para:
 *   - permitir buscas por titular (mesma chave → mesmo token)
 *   - inviabilizar engenharia reversa (HMAC sem a chave é irreversível)
 *   - permitir rotação periódica da chave para anonimização total
 *
 * Construtor recebe a chave por DI — testes passam chave literal,
 * produção lê de env via factory `createDefaultHasher()`.
 *
 * Output: hex de 64 chars (256 bits) — cabe direto na coluna
 * `subject_token TEXT` do Postgres.
 */
export class SubjectTokenHasher {
  constructor(private readonly key: string) {
    if (!key || key.length < 16) {
      throw new Error(
        'SubjectTokenHasher: chave HMAC deve ter ≥ 16 chars (entropia mínima)',
      )
    }
  }

  hash(rawSubjectId: string): string {
    if (!rawSubjectId) {
      throw new Error('SubjectTokenHasher.hash: rawSubjectId não pode ser vazio')
    }
    return createHmac('sha256', this.key).update(rawSubjectId).digest('hex')
  }

  /**
   * Comparação timing-safe entre dois tokens — evita timing attacks
   * em fluxos de matching (ex: "este token pertence a este CPF?").
   */
  matches(token: string, rawSubjectId: string): boolean {
    const expected = this.hash(rawSubjectId)
    if (token.length !== expected.length) return false
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  }
}

/**
 * Factory padrão — lê PII_HMAC_KEY do ambiente.
 * Lança erro claro se a chave não estiver configurada.
 */
export function createDefaultSubjectTokenHasher(): SubjectTokenHasher {
  const key = process.env.PII_HMAC_KEY
  if (!key) {
    throw new Error('PII_HMAC_KEY não configurada — exigida para audit trail LGPD')
  }
  return new SubjectTokenHasher(key)
}
