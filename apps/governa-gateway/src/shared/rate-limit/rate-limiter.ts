// ============================================================
// rate-limiter.ts — Token bucket para rate limiting
//
// Algoritmo:
//   - Inicia com burstSize tokens (permite burst imediato).
//   - Cada acquire() consome 1 token.
//   - Tokens são reabastecidos proporcionalmente ao tempo decorrido
//     (até o limite burstSize).
//   - Se não houver tokens disponíveis, dorme 1/requestsPerSecond
//     antes de retornar.
//
// sleepFn e clockFn são injetáveis para facilitar testes unitários
// sem dependência de timers reais ou Date.now() real.
// ============================================================

export interface RateLimiterConfig {
  /** Tokens gerados por segundo. */
  requestsPerSecond: number
  /** Máximo de tokens acumulados (tamanho do burst). */
  burstSize:         number
}

type SleepFn = (ms: number) => Promise<void>
type ClockFn = () => number

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export class RateLimiter {
  private tokens:       number
  private lastRefillAt: number

  constructor(
    private readonly config:   RateLimiterConfig,
    private readonly sleepFn:  SleepFn = defaultSleep,
    private readonly clockFn:  ClockFn = Date.now,
  ) {
    if (config.requestsPerSecond <= 0) {
      throw new Error('RateLimiter: requestsPerSecond deve ser > 0')
    }
    if (config.burstSize < 0) {
      throw new Error('RateLimiter: burstSize deve ser >= 0')
    }
    this.tokens       = config.burstSize
    this.lastRefillAt = clockFn()
  }

  /**
   * Aguarda até que um token esteja disponível e o consome.
   * Retorna imediatamente se há tokens no bucket.
   */
  async acquire(): Promise<void> {
    this.refill()

    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }

    // Sem tokens → dormir tempo necessário para 1 token
    const msPerToken = 1000 / this.config.requestsPerSecond
    await this.sleepFn(msPerToken)

    // Após o sleep, reabastecer com o tempo que passou
    this.refill()

    // Garantir que não vá negativo (pode ocorrer em clocks mock estáticos)
    this.tokens = Math.max(0, this.tokens) - 1
  }

  /**
   * Reabastece tokens com base no tempo decorrido desde o último refill.
   * Limitado pelo burstSize.
   */
  private refill(): void {
    const now        = this.clockFn()
    const elapsed    = (now - this.lastRefillAt) / 1000          // segundos
    const newTokens  = elapsed * this.config.requestsPerSecond

    this.tokens       = Math.min(
      this.config.burstSize,
      this.tokens + newTokens,
    )
    this.lastRefillAt = now
  }

  /** Expõe tokens disponíveis — útil para testes e observabilidade. */
  get availableTokens(): number {
    return this.tokens
  }
}
