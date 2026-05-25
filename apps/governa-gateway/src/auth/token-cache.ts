// ============================================================
// token-cache.ts — Cache em memória com TTL e buffer de renovação
// Thread-safe para uso single-process (Node.js event loop).
// ============================================================
import { CachedToken } from '../shared/types/auth.types'

export class TokenCache {
  private entry: CachedToken | null = null

  /**
   * Retorna o token se ainda vigente (respeitando buffer), ou null se expirado.
   */
  get(): string | null {
    if (!this.entry) return null
    if (Date.now() >= this.entry.expiresAt) {
      this.entry = null
      return null
    }
    return this.entry.value
  }

  /**
   * Armazena o token com TTL calculado: (expires_in - buffer) segundos a partir de agora.
   * Se expires_in <= bufferSeconds, o token NÃO é cacheado (TTL seria ≤ 0).
   */
  set(value: string, expiresInSeconds: number, bufferSeconds: number): void {
    const effectiveTtl = expiresInSeconds - bufferSeconds
    if (effectiveTtl <= 0) {
      // Token expira antes do buffer → nunca cachear, forçar refresh sempre
      return
    }
    this.entry = {
      value,
      expiresAt: Date.now() + effectiveTtl * 1000,
    }
  }

  /**
   * Invalida o cache forçando refresh no próximo getToken().
   */
  clear(): void {
    this.entry = null
  }

  /**
   * Expõe o tempo de expiração para fins de teste.
   */
  get expiresAt(): number | null {
    return this.entry?.expiresAt ?? null
  }
}
