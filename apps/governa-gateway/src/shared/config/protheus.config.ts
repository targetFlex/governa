// ============================================================
// protheus.config.ts — Leitura e validação de env vars
// Falha explicitamente se variável obrigatória estiver ausente.
// ============================================================
import { AuthMode, ProtheusAuthConfig } from '../types/auth.types'

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `[governa-gateway] Variável de ambiente obrigatória ausente: ${key}. ` +
      `Verifique seu .env (referência em .env.example).`,
    )
  }
  return value
}

function parseAuthMode(raw: string | undefined): AuthMode {
  if (raw === 'oauth2' || raw === 'basic') return raw
  throw new Error(
    `[governa-gateway] PROTHEUS_AUTH_MODE inválido: "${raw}". ` +
    `Valores aceitos: "oauth2" | "basic".`,
  )
}

export function loadProtheusAuthConfig(): ProtheusAuthConfig {
  return {
    baseUrl:        requireEnv('PROTHEUS_BASE_URL'),
    clientId:       requireEnv('PROTHEUS_CLIENT_ID'),
    clientSecret:   requireEnv('PROTHEUS_CLIENT_SECRET'),
    basicUser:      requireEnv('PROTHEUS_BASIC_USER'),
    basicPass:      requireEnv('PROTHEUS_BASIC_PASS'),
    authMode:       parseAuthMode(process.env['PROTHEUS_AUTH_MODE']),
    tokenTtlBuffer: parseInt(process.env['PROTHEUS_TOKEN_TTL_BUFFER_S'] ?? '30', 10),
  }
}

export function loadHttpConfig() {
  return {
    timeoutMs:  parseInt(process.env['PROTHEUS_TIMEOUT_MS'] ?? '10000', 10),
    maxRetries: parseInt(process.env['PROTHEUS_MAX_RETRIES'] ?? '3', 10),
  }
}
