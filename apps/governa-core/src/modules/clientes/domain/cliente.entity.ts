/**
 * ClienteInterno — entidade de domínio do governa-core.
 *
 * Independente do Protheus: não importa nenhum schema TOTVS.
 * PII substituída por tokens HMAC (pseudonimização feita pelo gateway).
 *
 * Invariante: nenhum campo contém PII em texto claro (LGPD).
 */
export interface ClienteInterno {
  readonly clienteId:      string
  readonly loja:           string
  readonly nomeToken:      string        // HMAC SHA-256 do nome real
  readonly documentoToken: string        // HMAC SHA-256 do CPF/CNPJ
  readonly enderecoToken:  string        // HMAC SHA-256 do endereço
  readonly emailToken:     string | null
  readonly telefoneToken:  string | null
  readonly bloqueado:      boolean
}
