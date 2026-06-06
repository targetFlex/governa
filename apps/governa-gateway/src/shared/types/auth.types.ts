// ============================================================
// auth.types.ts — Tipos base de autenticação com o Protheus
// ============================================================

export type AuthMode = 'oauth2' | 'basic'

export interface ProtheusTokenResponse {
  access_token: string
  token_type:   string
  expires_in:   number    // segundos
}

export interface CachedToken {
  value:     string
  expiresAt: number      // Date.now() + (expires_in - buffer) * 1000
}

export interface ProtheusAuthConfig {
  baseUrl:        string
  clientId:       string
  clientSecret:   string
  basicUser:      string
  basicPass:      string
  authMode:       AuthMode
  tokenTtlBuffer: number   // segundos — renovar antes do vencimento
}
