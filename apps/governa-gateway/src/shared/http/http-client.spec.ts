// ============================================================
// http-client.spec.ts — Critérios de aceite 4 e 5
//
// Estratégia: capturar os interceptors registrados em axios.create()
// e exercitá-los diretamente — sem depender de axios-mock-adapter.
// ============================================================
import axios from 'axios'
import { createHttpClient } from './http-client'
import { ProtheusAuthClient } from '../../auth/protheus-auth.client'
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios'

jest.mock('axios')
jest.mock('../../auth/protheus-auth.client')

const mockedAxios = axios as jest.Mocked<typeof axios>
const MockedAuthClient = ProtheusAuthClient as jest.MockedClass<typeof ProtheusAuthClient>

/** Captura os interceptors registrados e devolve callables para teste direto. */
function buildClientAndCaptureInterceptors(authClient: jest.Mocked<ProtheusAuthClient>) {
  let requestFulfilled!: (cfg: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>
  let responseFulfilled!: (res: AxiosResponse) => AxiosResponse
  let responseRejected!: (err: unknown) => Promise<unknown>

  const fakeInstance = {
    interceptors: {
      request:  { use: jest.fn((fn: Function) => { requestFulfilled = fn as any }) },
      response: { use: jest.fn((onFulfilled: Function, onRejected: Function) => {
        responseFulfilled = onFulfilled as any
        responseRejected  = onRejected as any
      }) },
    },
    // usado pelo interceptor de retry via instance.request()
    request: jest.fn(),
  }

  mockedAxios.create = jest.fn().mockReturnValue(fakeInstance)

  createHttpClient(authClient, 'https://protheus.test', 5000)

  return { requestFulfilled, responseFulfilled, responseRejected, fakeInstance }
}

function makeAuthClient(token = 'tok-test'): jest.Mocked<ProtheusAuthClient> {
  const instance = new MockedAuthClient({} as any) as jest.Mocked<ProtheusAuthClient>
  instance.getToken  = jest.fn().mockResolvedValue(token)
  instance.invalidate = jest.fn()
  return instance
}

function makeConfig(overrides: Partial<InternalAxiosRequestConfig> = {}): InternalAxiosRequestConfig {
  return { headers: {} as any, ...overrides } as InternalAxiosRequestConfig
}

// ------------------------------------------------------------------

describe('createHttpClient — interceptor de request', () => {
  beforeEach(() => jest.clearAllMocks())

  it('injeta Bearer token no header Authorization', async () => {
    const authClient = makeAuthClient('my-jwt')
    const { requestFulfilled } = buildClientAndCaptureInterceptors(authClient)

    const cfg = makeConfig()
    const result = await requestFulfilled(cfg)

    expect(result.headers['Authorization']).toBe('Bearer my-jwt')
  })

  it('injeta Basic token sem duplicar prefixo', async () => {
    const authClient = makeAuthClient('Basic dXNlcjpwYXNz')
    const { requestFulfilled } = buildClientAndCaptureInterceptors(authClient)

    const cfg = makeConfig()
    const result = await requestFulfilled(cfg)

    expect(result.headers['Authorization']).toBe('Basic dXNlcjpwYXNz')
    expect(result.headers['Authorization']).not.toMatch(/^Bearer /)
  })
})

describe('createHttpClient — interceptor de response (401)', () => {
  beforeEach(() => jest.clearAllMocks())

  // Critério 4: 401 → invalidar cache + retry com novo token
  it('ao receber 401, invalida cache e retenta request uma vez', async () => {
    const authClient = makeAuthClient()
    authClient.getToken = jest.fn()
      .mockResolvedValueOnce('tok-expired')
      .mockResolvedValueOnce('tok-fresh')

    const { responseRejected, fakeInstance } = buildClientAndCaptureInterceptors(authClient)

    fakeInstance.request = jest.fn().mockResolvedValue({ status: 200, data: {} })

    const error = {
      response: { status: 401 },
      config:   makeConfig(),
    }

    const result = await responseRejected(error) as AxiosResponse
    expect(result.status).toBe(200)
    // invalidate chamado 1x pelo interceptor de 401
    expect(authClient.invalidate).toHaveBeenCalledTimes(1)
    // getToken chamado 1x no retry (o interceptor de request não rodou neste unit test)
    expect(authClient.getToken).toHaveBeenCalledTimes(1)
    expect(fakeInstance.request).toHaveBeenCalledTimes(1)
  })

  // Critério 5: segundo 401 (retry já marcado) → erro propagado sem loop
  it('segunda tentativa com 401 → erro propagado, sem loop infinito', async () => {
    const authClient = makeAuthClient('tok-any')
    const { responseRejected, fakeInstance } = buildClientAndCaptureInterceptors(authClient)

    fakeInstance.request = jest.fn()

    // Simular request que já foi retentada (_retry = true)
    const error = {
      response: { status: 401 },
      config:   makeConfig({ _retry: true } as any),
    }

    await expect(responseRejected(error)).rejects.toMatchObject({
      response: { status: 401 },
    })

    // Não tentou retry de novo
    expect(fakeInstance.request).not.toHaveBeenCalled()
    expect(authClient.invalidate).not.toHaveBeenCalled()
  })

  it('erros não-401 são propagados sem retry', async () => {
    const authClient = makeAuthClient()
    const { responseRejected } = buildClientAndCaptureInterceptors(authClient)

    const error = { response: { status: 500 }, config: makeConfig() }
    await expect(responseRejected(error)).rejects.toMatchObject({ response: { status: 500 } })
    expect(authClient.invalidate).not.toHaveBeenCalled()
  })

  it('response bem-sucedida passa pelo fulfillment sem alteração', async () => {
    const authClient = makeAuthClient()
    const { responseFulfilled } = buildClientAndCaptureInterceptors(authClient)

    const res = { status: 200, data: { ok: true } } as AxiosResponse
    expect(responseFulfilled(res)).toBe(res)
  })
})
