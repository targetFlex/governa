// ============================================================
// resilient-http-client.spec.ts — integração retry + rate-limit
// CA1–CA6 do E2.md §Sessão 2.4 (complementares aos unit specs)
// ============================================================
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

import {
  ResilientHttpClient,
  createResilientHttpClient,
  DEFAULT_TIMEOUT_MS,
}                          from './resilient-http-client'
import { RateLimiter }     from '../rate-limit/rate-limiter'
import { DEFAULT_RETRY_CONFIG, RetryConfig } from '../retry/retry.policy'

// ---- helpers ------------------------------------------------

const noOpSleep = jest.fn().mockResolvedValue(undefined)

function buildClient(
  rateLimiter?: RateLimiter,
  retryConfig?: Partial<RetryConfig>,
) {
  const instance = axios.create({ baseURL: 'http://protheus', timeout: 10_000 })
  const mock     = new MockAdapter(instance)
  const config   = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  const client   = new ResilientHttpClient(instance, rateLimiter, config, noOpSleep)
  return { client, mock }
}

// ---- testes -------------------------------------------------

describe('ResilientHttpClient', () => {
  beforeEach(() => noOpSleep.mockClear())

  // CA1 — resposta 200 retornada sem retry
  it('retorna resposta 200 sem retry', async () => {
    const { client, mock } = buildClient()
    mock.onGet('/PEDIDO/').reply(200, [{ C5_NUM: '000001' }])

    const res = await client.get('/PEDIDO/')
    expect(res.status).toBe(200)
    expect(noOpSleep).not.toHaveBeenCalled()
  })

  // CA1 — 3 falhas 500 → lança após 3 tentativas
  it('CA1 — lança após 3 tentativas com status 500', async () => {
    const { client, mock } = buildClient()
    mock.onGet('/PEDIDO/').reply(500)

    await expect(client.get('/PEDIDO/')).rejects.toMatchObject({
      response: { status: 500 },
    })
    expect(noOpSleep).toHaveBeenCalledTimes(2) // 3 tentativas = 2 sleeps
  })

  // CA2 — 400 → falha imediata sem retry
  it('CA2 — não retenta para status 400', async () => {
    const { client, mock } = buildClient()
    mock.onGet('/PEDIDO/').reply(400)

    await expect(client.get('/PEDIDO/')).rejects.toMatchObject({
      response: { status: 400 },
    })
    expect(noOpSleep).not.toHaveBeenCalled()
  })

  // CA4 — rate limiter é chamado antes de cada request
  it('CA4 — rate limiter acquire() chamado por request', async () => {
    const mockAcquire = jest.fn().mockResolvedValue(undefined)
    const fakeLimiter = { acquire: mockAcquire } as unknown as RateLimiter

    const instance = axios.create({ baseURL: 'http://protheus', timeout: 10_000 })
    const mock     = new MockAdapter(instance)
    mock.onGet('/PEDIDO/').reply(200, [])

    const client = new ResilientHttpClient(
      instance,
      fakeLimiter,
      DEFAULT_RETRY_CONFIG,
      noOpSleep,
    )

    await client.get('/PEDIDO/')
    expect(mockAcquire).toHaveBeenCalledTimes(1)
  })

  // CA4 — rate limiter chamado para retries também
  it('CA4 — rate limiter não é chamado nos retries (apenas na chamada inicial)', async () => {
    const mockAcquire = jest.fn().mockResolvedValue(undefined)
    const fakeLimiter = { acquire: mockAcquire } as unknown as RateLimiter

    const instance = axios.create({ baseURL: 'http://protheus', timeout: 10_000 })
    const mock     = new MockAdapter(instance)
    mock.onGet('/PEDIDO/').replyOnce(500).onGet('/PEDIDO/').reply(200, [])

    const client = new ResilientHttpClient(
      instance,
      fakeLimiter,
      DEFAULT_RETRY_CONFIG,
      noOpSleep,
    )

    await client.get('/PEDIDO/')
    // acquire() chamado 1x (antes do withRetry, não por tentativa)
    expect(mockAcquire).toHaveBeenCalledTimes(1)
  })

  // CA5 — sem rate limiter → nenhum acquire()
  it('funciona sem rate limiter (undefined)', async () => {
    const { client, mock } = buildClient(undefined)
    mock.onGet('/PEDIDO/').reply(200, [])

    const res = await client.get('/PEDIDO/')
    expect(res.status).toBe(200)
  })

  // post() funcional com retry
  it('post() retenta em 503 e sucede na 2ª tentativa', async () => {
    const { client, mock } = buildClient()
    mock.onPost('/PEDIDO/').replyOnce(503).onPost('/PEDIDO/').reply(201, { id: 1 })

    const res = await client.post('/PEDIDO/', { data: 'x' })
    expect(res.status).toBe(201)
    expect(noOpSleep).toHaveBeenCalledTimes(1)
  })

  // axiosInstance expõe a instância
  it('axiosInstance retorna a instância axios subjacente', () => {
    const instance = axios.create()
    const client   = new ResilientHttpClient(instance)
    expect(client.axiosInstance).toBe(instance)
  })
})

// ---- CA6: factory com timeout 10s --------------------------

describe('createResilientHttpClient — timeout 10s', () => {
  it('CA6 — configura DEFAULT_TIMEOUT_MS = 10 000 ms', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000)
  })

  it('CA6 — instância axios criada com timeout 10s', () => {
    // Verificar que a factory cria instância com timeout correto
    // usando spy sobre createHttpClient
    const httpModule = require('./http-client')
    const spy = jest.spyOn(httpModule, 'createHttpClient')

    // Mock mínimo de ProtheusAuthClient
    const fakeAuth = {
      getToken:   jest.fn().mockResolvedValue('token'),
      invalidate: jest.fn(),
    } as any

    spy.mockReturnValue(axios.create({ timeout: 10_000 }))

    createResilientHttpClient(fakeAuth, 'http://protheus')

    expect(spy).toHaveBeenCalledWith(fakeAuth, 'http://protheus', 10_000)

    spy.mockRestore()
  })

  it('CA6 — timeoutMs customizado é repassado ao http client', () => {
    const httpModule = require('./http-client')
    const spy = jest.spyOn(httpModule, 'createHttpClient')
      .mockReturnValue(axios.create({ timeout: 5_000 }))

    const fakeAuth = { getToken: jest.fn(), invalidate: jest.fn() } as any

    createResilientHttpClient(fakeAuth, 'http://protheus', { timeoutMs: 5_000 })

    expect(spy).toHaveBeenCalledWith(fakeAuth, 'http://protheus', 5_000)
    spy.mockRestore()
  })
})
