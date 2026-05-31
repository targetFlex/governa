// ============================================================
// retry.edge.spec.ts — Edge cases da retry policy (E2.md §Sessão 2.4)
// ============================================================
import { withRetry, DEFAULT_RETRY_CONFIG, RetryConfig } from '../../src/shared/retry/retry.policy'

const noOpSleep = jest.fn().mockResolvedValue(undefined)

beforeEach(() => noOpSleep.mockClear())

// ---- helpers ------------------------------------------------

function makeHttpError(status: number): Error {
  const e: any = new Error(`HTTP ${status}`)
  e.response = { status }
  return e
}

function makeNetworkError(code = 'ERR_NETWORK'): Error {
  const e: any = new Error('Network Error')
  e.code = code
  return e
}

// ---- edge cases ---------------------------------------------

describe('retry policy — edge cases', () => {
  // EC1 — erro de rede (sem response.status) → retenta até maxAttempts
  it('EC1 — erro de rede sem status → retenta maxAttempts vezes', async () => {
    const fn = jest.fn().mockRejectedValue(makeNetworkError())

    await expect(withRetry(fn, DEFAULT_RETRY_CONFIG, noOpSleep)).rejects.toThrow('Network Error')
    expect(fn).toHaveBeenCalledTimes(3) // esgota todas as tentativas
    expect(noOpSleep).toHaveBeenCalledTimes(2) // 3 tentativas = 2 sleeps
  })

  // EC1 — ECONNABORTED também não tem status e deve ser retentado
  it('EC1 — ECONNABORTED (timeout Axios) → retentado', async () => {
    const fn = jest.fn().mockRejectedValue(makeNetworkError('ECONNABORTED'))

    await expect(withRetry(fn, DEFAULT_RETRY_CONFIG, noOpSleep)).rejects.toBeDefined()
    expect(fn).toHaveBeenCalledTimes(3)
  })

  // EC2 — 429 com Retry-After: withRetry usa o delay configurado
  //       (o header Retry-After requer tratamento externo ao withRetry;
  //        o delay configurado é o fallback padrão)
  it('EC2 — 429 é retentado com delay padrão (Retry-After é responsabilidade do caller)', async () => {
    const delays: number[] = []
    const mockSleep = jest.fn((ms: number) => { delays.push(ms); return Promise.resolve() })
    const fn = jest.fn().mockRejectedValue(makeHttpError(429))

    await expect(withRetry(fn, DEFAULT_RETRY_CONFIG, mockSleep)).rejects.toBeDefined()
    expect(fn).toHaveBeenCalledTimes(3)
    expect(delays).toEqual([200, 400]) // delays padrão
  })

  // EC3 — maxAttempts = 1 → falha imediata, sem retry
  it('EC3 — maxAttempts = 1 → falha imediata sem sleep', async () => {
    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, maxAttempts: 1 }
    const fn = jest.fn().mockRejectedValue(makeHttpError(500))

    await expect(withRetry(fn, config, noOpSleep)).rejects.toBeDefined()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(noOpSleep).not.toHaveBeenCalled()
  })

  // EC4 — delay não acumula entre withRetry independentes
  it('EC4 — delay recomeça em initialDelayMs em cada chamada a withRetry', async () => {
    const delays: number[] = []
    const mockSleep = jest.fn((ms: number) => { delays.push(ms); return Promise.resolve() })

    const err = makeHttpError(500)

    // 1ª chamada independente — falha 3x
    await expect(withRetry(jest.fn().mockRejectedValue(err), DEFAULT_RETRY_CONFIG, mockSleep)).rejects.toBeDefined()
    const firstBatch = [...delays]

    delays.length = 0

    // 2ª chamada independente — também começa em 200ms
    await expect(withRetry(jest.fn().mockRejectedValue(err), DEFAULT_RETRY_CONFIG, mockSleep)).rejects.toBeDefined()
    const secondBatch = [...delays]

    expect(firstBatch).toEqual([200, 400])
    expect(secondBatch).toEqual([200, 400]) // não acumulou
  })

  // extra — sucesso na última tentativa
  it('sucede na 3ª tentativa após 2 falhas retentáveis', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(makeHttpError(503))
      .mockRejectedValueOnce(makeHttpError(502))
      .mockResolvedValueOnce('final')

    const result = await withRetry(fn, DEFAULT_RETRY_CONFIG, noOpSleep)
    expect(result).toBe('final')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  // extra — error não retentável na 2ª tentativa → para imediatamente
  it('para ao encontrar status não retentável em retry', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(makeHttpError(500))  // retentável
      .mockRejectedValueOnce(makeHttpError(400))  // não retentável → para

    await expect(withRetry(fn, DEFAULT_RETRY_CONFIG, noOpSleep)).rejects.toMatchObject({
      response: { status: 400 },
    })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(noOpSleep).toHaveBeenCalledTimes(1) // apenas 1 sleep (entre 1ª e 2ª)
  })
})
