// ============================================================
// rate-limit.edge.spec.ts — Edge cases do RateLimiter
// ============================================================
import { RateLimiter } from '../../src/shared/rate-limit/rate-limiter'

// ---- helpers ------------------------------------------------

function buildLimiter(
  rps: number,
  burst: number,
  sleepFn = jest.fn().mockResolvedValue(undefined),
  clockFn?: () => number,
) {
  return { limiter: new RateLimiter({ requestsPerSecond: rps, burstSize: burst }, sleepFn, clockFn), sleepFn }
}

// ---- edge cases ---------------------------------------------

describe('RateLimiter — edge cases', () => {
  // EC1 — burstSize = 0 → sleep no primeiro acquire
  it('EC1 — burstSize = 0: dorme no primeiro acquire', async () => {
    const { limiter, sleepFn } = buildLimiter(10, 0)
    await limiter.acquire()
    expect(sleepFn).toHaveBeenCalledTimes(1)
    expect(sleepFn).toHaveBeenCalledWith(100) // 1000 / 10
  })

  // EC2 — requestsPerSecond = 1 → sleep de 1000ms quando esgotado
  it('EC2 — 1 req/s: sleep de 1000ms quando esgotado', async () => {
    const { limiter, sleepFn } = buildLimiter(1, 1)
    await limiter.acquire() // consome o único token do burst
    await limiter.acquire() // sem token → sleep(1000)
    expect(sleepFn).toHaveBeenCalledWith(1000)
  })

  // EC3 — clock estático: refill não acrescenta tokens, sleeps consecutivos
  it('EC3 — clock estático: sleeps consecutivos após esgotar burst', async () => {
    let nowMs = 0
    const { limiter, sleepFn } = buildLimiter(10, 2, undefined, () => nowMs)
    // Drenar burst
    await limiter.acquire()
    await limiter.acquire()
    // Sem tokens e clock estático → sleep nas próximas 3 chamadas
    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()
    expect(sleepFn).toHaveBeenCalledTimes(3)
  })

  // EC4 — refill parcial: meio segundo → metade dos tokens
  it('EC4 — refill parcial: 500ms gera 5 tokens com 10 rps', async () => {
    let nowMs = 0
    const { limiter } = buildLimiter(10, 10, jest.fn().mockResolvedValue(undefined), () => nowMs)

    // Drenar todos os tokens
    for (let i = 0; i < 10; i++) await limiter.acquire()
    expect(limiter.availableTokens).toBeCloseTo(0, 0)

    // Avançar 500ms → 5 tokens novos
    nowMs = 500
    // O acquire() vai chamar refill() → tokens = 0 + 5 = 5
    await limiter.acquire() // consome 1
    expect(limiter.availableTokens).toBeCloseTo(4, 0)
  })

  // EC5 — refill não ultrapassa burstSize mesmo com clock grande
  it('EC5 — refill limitado a burstSize (sem "overflow" de tokens)', async () => {
    let nowMs = 0
    const { limiter, sleepFn } = buildLimiter(10, 3, undefined, () => nowMs)

    // Drenar burst
    for (let i = 0; i < 3; i++) await limiter.acquire()

    // Avançar 100 segundos → 1000 tokens possíveis, mas cap em 3
    nowMs = 100_000

    for (let i = 0; i < 3; i++) await limiter.acquire()

    // Nenhum sleep — tokens foram refilled até o máximo de 3
    expect(sleepFn).not.toHaveBeenCalled()
  })

  // EC6 — requests de alta frequência: apenas o burst passa sem sleep
  it('EC6 — 10 requests com burst=5 resultam em 5 sleeps', async () => {
    const { limiter, sleepFn } = buildLimiter(20, 5)

    for (let i = 0; i < 10; i++) await limiter.acquire()

    expect(sleepFn).toHaveBeenCalledTimes(5)
    expect(sleepFn).toHaveBeenCalledWith(50) // 1000 / 20
  })

  // EC7 — guard: requestsPerSecond = 0 lança erro descritivo
  it('EC7 — requestsPerSecond = 0 lança erro na criação', () => {
    expect(() => new RateLimiter({ requestsPerSecond: 0, burstSize: 5 }))
      .toThrow('requestsPerSecond deve ser > 0')
  })

  // EC8 — guard: burstSize negativo lança erro
  it('EC8 — burstSize negativo lança erro na criação', () => {
    expect(() => new RateLimiter({ requestsPerSecond: 5, burstSize: -1 }))
      .toThrow('burstSize deve ser >= 0')
  })
})
