// ============================================================
// cliente.mapper.ts — Conversão ProtheusCilenteRaw → ClienteInterno
//
// Responsabilidades:
//   - Mapear campos TOTVS (SA1) para o modelo interno
//   - Pseudonimizar campos PII via PiiPseudonymizer (HMAC SHA-256)
//
// SRP: apenas mapeamento e pseudonimização.
//      Nenhuma validação de schema e nenhuma lógica HTTP.
// ============================================================

import {
  ClienteInterno,
  ProtheusCilenteRaw,
  TIPO_MAP,
} from './cliente.schema'
import { PiiPseudonymizer } from '../shared/pii.pseudonymizer'

export class ClienteMapper {
  /**
   * @param pseudonymizer — Injetado para pseudonimização de PII.
   *   Permite substituição por spy/mock nos testes (sem I/O real).
   */
  constructor(private readonly pseudonymizer: PiiPseudonymizer) {}

  /**
   * Converte um cliente raw (já validado pelo Zod) para o modelo interno.
   * Campos PII são substituídos por hashes HMAC SHA-256.
   */
  toInterno(raw: ProtheusCilenteRaw): ClienteInterno {
    return {
      codigoCliente:   raw.A1_COD,
      loja:            raw.A1_LOJA,
      nomePseudo:      this.pseudonymizer.pseudonymize(raw.A1_NOME),
      tipo:            TIPO_MAP[raw.A1_TIPO],
      ativo:           raw.A1_ATIVO === 'S',
      documentoPseudo: this.pseudonymizer.pseudonymize(raw.A1_CGC),
      emailPseudo:     this.pseudonymizer.pseudonymizeIfPresent(raw.A1_EMAIL),
      telefonePseudo:  this.pseudonymizer.pseudonymizeIfPresent(raw.A1_TEL),
      enderecoPseudo:  this.pseudonymizer.pseudonymize(this.canonicalEndereco(raw)),
    }
  }

  // ── Helper privado ──────────────────────────────────────

  /**
   * Representação canônica do endereço para hash único.
   * Ordem fixa dos campos garante determinismo do HMAC.
   */
  private canonicalEndereco(raw: ProtheusCilenteRaw): string {
    return `${raw.A1_END}|${raw.A1_MUN}|${raw.A1_EST}|${raw.A1_CEP}`
  }
}
