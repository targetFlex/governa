// ============================================================
// rate-limiter.spec.ts — CA4, CA5 e CA6 (E2.md §Sessão 2.4)
// ============================================================
import { RateLimiter, RateLimiterConfig } from './rate-limiter'

// ---- helpers ------------------------------------------------

function buildLimiter(
  config: RateLimiterConfig,
  sleepFn: (ms: number) => Promise<void> = jest.fn().mockResolvedValue(undefined),
  clockFn?: () => number,
): RateLimiter {
  return new RateLimiter(config, sleepFn, clockFn)
}

// ---- testes -------------------------------------------------

describe('RateLimiter — token bucket', () => {
  // CA5 — burst de burstSize imediatos sem sleep
  it('CA5 — permite burst imediato de burstSize requests sem sleep', async () => {
    const mockSleep = jest.fn().mockResolvedValue(undefined)
    const limiter = new RateLimiter(
      { requestsPerSecond: 10, burstSize: 5 },
      mockSleep,
    )

    for (let i = 0; i < 5; i++) {
      await limiter.acquire()
    }

    expect(mockSleep).not.toHaveBeenCalled()
  })

  // CA4 — após esgotar tokens, dorme 1/requestsPerSecond
  it('CA4 — dorme quando tokens esgotados (100ms para 10 rps)', async () => {
    const mockSleep = jest.fn().mockResolvedValue(undefined)
    const limiter = new RateLimiter(
      { requestsPerSecond: 10, burstSize: 2 },
      mockSleep,
    )

    await limiter.acquire() // token 1
    await limiter.acquire() // token 2
    await limiter.acquire() // esgotado → sleep(100)

    expect(mockSleep).toHaveBeenCalledTimes(1)
    expect(mockSleep).toHaveBeenCalledWith(100) // 1000 / 10
  })

  // CA4 — throttle correto: cada acquire além do burst dorme
  it('CA4 — N requests além do burst resultam em N sleeps', async () => {
    const mockSleep = jest.fn().mockResolvedValue(undefined)
    const limiter = new RateLimiter(
      { requestsPerSecond: 5, burstSize: 3 },
      mockSleep,
    )

    for (let i = 0; i < 6; i++) {
      await limiter.acquire()
    }

    expect(mockSleep).toHaveBeenCalledTimes(3) // 6 - 3 burst = 3 sleeps
    expect(mockSleep).toHaveBeenCalledWith(200) // 1000 / 5
  })

  // refill — tokens são reabastecidos com base no tempo
  it('tokens são refilled com base no tempo decorrido', async () => {
    let nowMs = 0
    const clockFn = () => nowMs
    const mockSleep = jest.fn().mockResolvedValue(undefined)

    const limiter = new RateLimiter(
      { requestsPerSecond: 10, burstSize: 10 },
      mockSleep,
      clockFn,
    )

    // Drenar todos os tokens (burst = 10)
    for (let i = 0; i < 10; i++) {
      await limiter.acquire()
    }

    expect(mockSleep).not.toHaveBeenCalled()

    // Avançar 1 segundo → 10 novos tokens
    nowMs = 1000

    // 10 acquires adicionais devem ser imediatos
    for (let i = 0; i < 10; i++) {
      await limiter.acquire()
    }

    expect(mockSleep).not.toHaveBeenCalled()
  })

  // refill não excede burstSize
  it('refill não ultrapassa burstSize', async () => {
    let nowMs = 0
    const limiter = new RateLimiter(
      { requestsPerSecond: 5, burstSize: 3 },
      jest.fn().mockResolvedValue(undefined),
      () => nowMs,
    )

    // Avançar 10 segundos → 50 tokens gerados, mas capped em 3
    nowMs = 10_000

    await limiter.acquire()
    expect(limiter.availableTokens).toBeCloseTo(2, 0)
  })

  // guard — requestsPerSecond inválido
  it('lança erro se requestsPerSecond <= 0', () => {
    expect(() => new RateLimiter({ requestsPerSecond: 0, burstSize: 5 }))
      .toThrow('requestsPerSecond deve ser > 0')
  })

  // guard — burstSize negativo
  it('lança erro se burstSize < 0', () => {
    expect(() => new RateLimiter({ requestsPerSecond: 10, burstSize: -1 }))
      .toThrow('burstSize deve ser >= 0')
  })

  // burstSize = 0 → sleep desde o primeiro acquire
  it('burstSize = 0 → dorme desde o 1º acquire', async () => {
    const mockSleep = jest.fn().mockResolvedValue(undefined)
    const limiter = new RateLimiter(
      { requestsPerSecond: 10, burstSize: 0 },
      mockSleep,
    )

    await limiter.acquire()

    expect(mockSleep).toHaveBeenCalledTimes(1)
  })
})
