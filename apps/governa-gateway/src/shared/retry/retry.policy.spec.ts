// ============================================================
// retry.policy.spec.ts — 6 critérios de aceite (E2.md §Sessão 2.4)
// ============================================================
import { withRetry, DEFAULT_RETRY_CONFIG, RetryConfig, sleep } from './retry.policy'

// ---- helpers ------------------------------------------------

function makeHttpError(status: number): Error {
  const err: any = new Error(`HTTP ${status}`)
  err.response = { status }
  return err
}

function makeNetworkError(): Error {
  // Sem response.status → erro de rede
  const err: any = new Error('Network Error')
  err.code = 'ERR_NETWORK'
  return err
}

function noOpSleep(_ms: number): Promise<void> {
  return Promise.resolve()
}

// ---- testes -------------------------------------------------

describe('withRetry', () => {
  // CA1 — sucesso na 1ª tentativa
  it('retorna resultado na 1ª tentativa sem retry', async () => {
    const fn = jest.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, DEFAULT_RETRY_CONFIG, noOpSleep)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  // CA1 — 3ª tentativa com 500 → propaga após 3 chamadas
  it('CA1 — propaga UpstreamError após 3 tentativas com status 500', async () => {
    const err = makeHttpError(500)
    const fn = jest.fn().mockRejectedValue(err)

    await expect(withRetry(fn, DEFAULT_RETRY_CONFIG, noOpSleep)).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(3) // maxAttempts = 3
  })

  // CA2 — erro 400 → falha imediata, sem retry
  it('CA2 — não retenta para status 400 (não retentável)', async () => {
    const err = makeHttpError(400)
    const fn = jest.fn().mockRejectedValue(err)

    await expect(withRetry(fn, DEFAULT_RETRY_CONFIG, noOpSleep)).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1) // sem retry
  })

  // CA2 — outros não-retentáveis: 401, 403, 404
  it.each([401, 403, 404])(
    'não retenta para status %i',
    async (status) => {
      const fn = jest.fn().mockRejectedValue(makeHttpError(status))
      await expect(withRetry(fn, DEFAULT_RETRY_CONFIG, noOpSleep)).rejects.toBeDefined()
      expect(fn).toHaveBeenCalledTimes(1)
    },
  )

  // CA1 — retenta todos os statuses retentáveis padrão
  it.each([408, 429, 500, 502, 503, 504])(
    'retenta para status %i (retentável)',
    async (status) => {
      const fn = jest.fn().mockRejectedValue(makeHttpError(status))
      await expect(withRetry(fn, DEFAULT_RETRY_CONFIG, noOpSleep)).rejects.toBeDefined()
      expect(fn).toHaveBeenCalledTimes(3)
    },
  )

  // CA3 — sequência de delays: 200ms → 400ms (com maxAttempts=3 há 2 sleeps)
  it('CA3 — aplica delays 200ms e 400ms com maxAttempts=3', async () => {
    const delays: number[] = []
    const mockSleep = jest.fn((ms: number) => {
      delays.push(ms)
      return Promise.resolve()
    })

    const fn = jest.fn().mockRejectedValue(makeHttpError(500))
    await expect(withRetry(fn, DEFAULT_RETRY_CONFIG, mockSleep)).rejects.toBeDefined()

    expect(delays).toEqual([200, 400])
  })

  // CA3 — sequência completa 200ms → 400ms → 800ms com 4 tentativas
  it('CA3 — sequência completa 200ms → 400ms → 800ms com maxAttempts=4', async () => {
    const delays: number[] = []
    const mockSleep = jest.fn((ms: number) => {
      delays.push(ms)
      return Promise.resolve()
    })

    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, maxAttempts: 4 }
    const fn = jest.fn().mockRejectedValue(makeHttpError(500))

    await expect(withRetry(fn, config, mockSleep)).rejects.toBeDefined()
    expect(delays).toEqual([200, 400, 800])
  })

  // sucesso na 2ª tentativa — retry funcional end-to-end
  it('sucede na 2ª tentativa após 1 falha retentável', async () => {
    const mockSleep = jest.fn().mockResolvedValue(undefined)
    const fn = jest.fn()
      .mockRejectedValueOnce(makeHttpError(503))
      .mockResolvedValueOnce('recuperado')

    const result = await withRetry(fn, DEFAULT_RETRY_CONFIG, mockSleep)

    expect(result).toBe('recuperado')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(mockSleep).toHaveBeenCalledTimes(1)
    expect(mockSleep).toHaveBeenCalledWith(200)
  })

  // sleep real — smoke test (apenas verifica que não trava)
  it('sleep() resolve após o tempo indicado (real timer — smoke)', async () => {
    const start = Date.now()
    await sleep(50)
    expect(Date.now() - start).toBeGreaterThanOrEqual(40)
  })
})
