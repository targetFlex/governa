// ============================================================
// protheus-auth.client.spec.ts — Critérios de aceite 1, 2, 3, 6
// ============================================================
import axios from 'axios'
import { ProtheusAuthClient } from './protheus-auth.client'
import { ProtheusAuthConfig } from '../shared/types/auth.types'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

function makeConfig(overrides: Partial<ProtheusAuthConfig> = {}): ProtheusAuthConfig {
  return {
    baseUrl:        'https://protheus.test/rest',
    clientId:       'client_id',
    clientSecret:   'client_secret',
    basicUser:      'user',
    basicPass:      'pass',
    authMode:       'oauth2',
    tokenTtlBuffer: 30,
    ...overrides,
  }
}

describe('ProtheusAuthClient — OAuth2', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // Critério 1: getToken() usa cache — axios.post chamado apenas 1x
  it('retorna token do cache na segunda chamada sem nova request HTTP', async () => {
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { access_token: 'tok-123', token_type: 'Bearer', expires_in: 3600 },
    })

    const client = new ProtheusAuthClient(makeConfig())
    const t1 = await client.getToken()
    const t2 = await client.getToken()

    expect(t1).toBe('tok-123')
    expect(t2).toBe('tok-123')
    expect(mockedAxios.post).toHaveBeenCalledTimes(1)
  })

  // Critério 2: cache invalida automaticamente antes do buffer
  it('faz novo request quando token expira pelo buffer', async () => {
    mockedAxios.post = jest.fn()
      .mockResolvedValueOnce({
        data: { access_token: 'tok-first', token_type: 'Bearer', expires_in: 60 },
      })
      .mockResolvedValueOnce({
        data: { access_token: 'tok-second', token_type: 'Bearer', expires_in: 60 },
      })

    const client = new ProtheusAuthClient(makeConfig({ tokenTtlBuffer: 30 }))
    const t1 = await client.getToken()
    expect(t1).toBe('tok-first')

    // Avançar além do buffer (60-30=30s de TTL efetivo)
    jest.advanceTimersByTime(31_000)

    const t2 = await client.getToken()
    expect(t2).toBe('tok-second')
    expect(mockedAxios.post).toHaveBeenCalledTimes(2)
  })

  it('invalidate() força novo request na chamada seguinte', async () => {
    mockedAxios.post = jest.fn()
      .mockResolvedValueOnce({
        data: { access_token: 'tok-a', token_type: 'Bearer', expires_in: 3600 },
      })
      .mockResolvedValueOnce({
        data: { access_token: 'tok-b', token_type: 'Bearer', expires_in: 3600 },
      })

    const client = new ProtheusAuthClient(makeConfig())
    await client.getToken()
    client.invalidate()
    const t2 = await client.getToken()

    expect(t2).toBe('tok-b')
    expect(mockedAxios.post).toHaveBeenCalledTimes(2)
  })

  it('Protheus retorna 500 → UpstreamError com code PROTHEUS_AUTH_UNAVAILABLE', async () => {
    mockedAxios.post = jest.fn().mockRejectedValue({
      response: { status: 500 },
    })

    const client = new ProtheusAuthClient(makeConfig())
    await expect(client.getToken()).rejects.toMatchObject({
      name:       'UpstreamError',
      code:       'PROTHEUS_AUTH_UNAVAILABLE',
      httpStatus: 500,
    })
  })
})

describe('ProtheusAuthClient — Basic Auth', () => {
  // Critério 3: modo basic não faz chamada HTTP
  it('retorna token Basic sem chamada HTTP', async () => {
    mockedAxios.post = jest.fn()

    const client = new ProtheusAuthClient(makeConfig({ authMode: 'basic' }))
    const token = await client.getToken()

    expect(token).toMatch(/^Basic /)
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it('Basic token é codificação Base64 correta de user:pass', async () => {
    const client = new ProtheusAuthClient(
      makeConfig({ authMode: 'basic', basicUser: 'myUser', basicPass: 'myPass' }),
    )
    const token = await client.getToken()
    const expected = 'Basic ' + Buffer.from('myUser:myPass').toString('base64')
    expect(token).toBe(expected)
  })
})

describe('ProtheusAuthClient — Validação de config', () => {
  // Critério 6: PROTHEUS_BASE_URL ausente → erro descritivo
  it('lança erro descritivo se baseUrl estiver vazio', () => {
    expect(() => new ProtheusAuthClient(makeConfig({ baseUrl: '' }))).toThrow(
      'PROTHEUS_BASE_URL é obrigatório',
    )
  })

  it('lança erro descritivo se authMode for inválido', () => {
    expect(() =>
      new ProtheusAuthClient(makeConfig({ authMode: 'invalid' as any })),
    ).toThrow('authMode inválido')
  })
})

describe('ProtheusAuthClient — Deduplicação de chamadas simultâneas', () => {
  beforeEach(() => jest.clearAllMocks())

  // Edge case: dois getToken() simultâneos → apenas 1 chamada HTTP
  it('dois getToken() simultâneos disparam apenas 1 chamada OAuth2', async () => {
    let resolve: (v: any) => void
    const pending = new Promise((res) => { resolve = res })

    mockedAxios.post = jest.fn().mockReturnValue(
      pending.then(() => ({
        data: { access_token: 'tok-dedup', token_type: 'Bearer', expires_in: 3600 },
      })),
    )

    const client = new ProtheusAuthClient(makeConfig())
    const [t1, t2] = await Promise.all([
      client.getToken(),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (async () => { resolve!(null); return client.getToken() })(),
    ])

    expect(t1).toBe('tok-dedup')
    expect(t2).toBe('tok-dedup')
    expect(mockedAxios.post).toHaveBeenCalledTimes(1)
  })
})
