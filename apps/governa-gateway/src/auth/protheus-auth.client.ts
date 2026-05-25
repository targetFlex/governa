// ============================================================
// protheus-auth.client.ts — Client de autenticação Protheus
//
// Suporta dois modos configuráveis via PROTHEUS_AUTH_MODE:
//   - oauth2: client_credentials, com token cacheado e refresh automático
//   - basic:  Base64(user:pass) — sem chamada HTTP, sem cache
//
// Invariante: getToken() nunca retorna token expirado.
// ============================================================
import axios from 'axios'
import { TokenCache } from './token-cache'
import { ProtheusAuthConfig, ProtheusTokenResponse } from '../shared/types/auth.types'
import { handleAuthError } from '../shared/errors/protheus-errors'

export class ProtheusAuthClient {
  private readonly cache: TokenCache
  // Mutex simples para evitar race condition em chamadas simultâneas
  private inflightRequest: Promise<string> | null = null

  constructor(private readonly config: ProtheusAuthConfig) {
    this.validateConfig(config)
    this.cache = new TokenCache()
  }

  /**
   * Retorna token válido:
   * - OAuth2: do cache se vigente, novo se expirado (com deduplicação de chamadas)
   * - Basic:  token calculado localmente, sem cache e sem HTTP
   */
  async getToken(): Promise<string> {
    if (this.config.authMode === 'basic') {
      return this.buildBasicToken()
    }

    // OAuth2: verificar cache primeiro
    const cached = this.cache.get()
    if (cached) return cached

    // Deduplicate: se já há uma chamada em flight, reutilizar
    if (this.inflightRequest) {
      return this.inflightRequest
    }

    this.inflightRequest = this.fetchOAuth2Token().finally(() => {
      this.inflightRequest = null
    })

    return this.inflightRequest
  }

  /**
   * Invalida o cache forçando refresh no próximo getToken().
   * Usar após receber 401 do Protheus.
   */
  invalidate(): void {
    this.cache.clear()
  }

  // ----------------------------------------------------------
  // Privados
  // ----------------------------------------------------------

  private async fetchOAuth2Token(): Promise<string> {
    try {
      const response = await axios.post<ProtheusTokenResponse>(
        `${this.config.baseUrl}/oauth2/token`,
        new URLSearchParams({
          grant_type:    'client_credentials',
          client_id:     this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )

      const { access_token, expires_in } = response.data
      this.cache.set(access_token, expires_in, this.config.tokenTtlBuffer)
      return access_token
    } catch (error) {
      throw handleAuthError(error, 'ProtheusAuthClient')
    }
  }

  private buildBasicToken(): string {
    const encoded = Buffer.from(
      `${this.config.basicUser}:${this.config.basicPass}`,
    ).toString('base64')
    return `Basic ${encoded}`
  }

  private validateConfig(config: ProtheusAuthConfig): void {
    if (!config.baseUrl) {
      throw new Error('[ProtheusAuthClient] PROTHEUS_BASE_URL é obrigatório')
    }
    if (config.authMode !== 'oauth2' && config.authMode !== 'basic') {
      throw new Error(
        `[ProtheusAuthClient] authMode inválido: "${config.authMode}". Use "oauth2" ou "basic".`,
      )
    }
  }
}
