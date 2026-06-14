// ============================================================
// pii.pseudonymizer.ts — Pseudonimização de campos PII via HMAC SHA-256
//
// Transforma dados pessoais identificáveis (CPF/CNPJ, e-mail,
// telefone) em hashes determinísticos irreversíveis.
//
// Propriedades garantidas:
//   - Determinismo:   mesma entrada + mesma chave → mesmo hash
//   - Irreversibilidade: hash não permite reconstruir o original
//   - Isolamento:     chaves diferentes → hashes diferentes
//
// SRP: este módulo NÃO valida campos, NÃO faz I/O e NÃO lê env.
//      A chave secreta é injetada pelo chamador (DI).
// ============================================================

import { createHmac } from 'crypto'

export class PiiPseudonymizer {
  /**
   * @param secretKey — Chave HMAC injetada pelo chamador.
   *   Nunca hardcode. Usar env var (ex: PSEUDONYMIZER_SECRET).
   *   Mínimo recomendado: 32 bytes (256 bits).
   */
  constructor(private readonly secretKey: string) {
    if (!secretKey || secretKey.trim().length === 0) {
      throw new Error('PiiPseudonymizer: secretKey não pode ser vazia')
    }
  }

  /**
   * Pseudonimiza um valor PII usando HMAC SHA-256.
   * Retorna string hexadecimal de 64 caracteres.
   */
  pseudonymize(value: string): string {
    return createHmac('sha256', this.secretKey)
      .update(value)
      .digest('hex')
  }

  /**
   * Pseudonimiza apenas se o valor estiver presente e não-vazio.
   * Retorna null para null, undefined ou string vazia/espaços.
   *
   * Uso: campos opcionais como e-mail e telefone no Protheus.
   */
  pseudonymizeIfPresent(value: string | null | undefined): string | null {
    if (value == null || value.trim() === '') return null
    return this.pseudonymize(value)
  }
}
