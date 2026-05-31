// ============================================================
// auth-login.connector.ts
//
// Conector de autenticação de usuário via Protheus REST.
//
// Contrato de entrada (POST /auth/login):
//   { email: string, password: string }
//
// Contrato de saída:
//   { token: string, expiresIn: number }
//
// Erros mapeados:
//   401 Protheus → UpstreamError PROTHEUS_UNAUTHORIZED
//   5xx Protheus → UpstreamError PROTHEUS_INTERNAL_ERROR
//   timeout      → UpstreamError PROTHEUS_TIMEOUT
//
// Arquitetura: porta de saída — testável sem Protheus real.
// ============================================================

import axios from 'axios'
import { handleUpstreamError } from '../../shared/errors/protheus-errors'

// ── Tipos públicos ────────────────────────────────────────────

export interface LoginParams {
  email:    string
  password: string
}

export interface LoginResult {
  token:     string
  expiresIn: number
}

// ── Porta (interface injetável) ───────────────────────────────

export interface IAuthLoginConnector {
  execute(params: LoginParams): Promise<LoginResult>
}

// ── Implementação Protheus ────────────────────────────────────

export class ProtheusLoginConnector implements IAuthLoginConnector {
  /**
   * @param baseUrl URL base do Protheus REST (ex: https://protheus.empresa.com/rest)
   */
  constructor(private readonly baseUrl: string) {}

  /**
   * Autentica o usuário via Resource Owner Password Grant no Protheus.
   *
   * Fluxo:
   *   POST ${baseUrl}/oauth2/token
   *   grant_type=password&username=${email}&password=${password}
   *   → { access_token, expires_in }
   */
  async execute({ email, password }: LoginParams): Promise<LoginResult> {
    try {
      const response = await axios.post<{ access_token: string; expires_in: number }>(
        `${this.baseUrl}/oauth2/token`,
        new URLSearchParams({
          grant_type: 'password',
          username:   email,
          password,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )

      return {
        token:     response.data.access_token,
        expiresIn: response.data.expires_in,
      }
    } catch (error: unknown) {
      throw handleUpstreamError(error, 'auth_login')
    }
  }
}
