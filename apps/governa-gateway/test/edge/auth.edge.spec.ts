// ============================================================
// auth.edge.spec.ts — Edge cases obrigatórios da sessão 2.1
// ============================================================
import axios from 'axios'
import { ProtheusAuthClient } from '../../src/auth/protheus-auth.client'
import { ProtheusAuthConfig } from '../../src/shared/types/auth.types'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

function makeConfig(overrides: Partial<ProtheusAuthConfig> = {}): ProtheusAuthConfig {
  return {
    baseUrl:        'https://protheus.test/rest',
    clientId:       'cid',
    clientSecret:   'csec',
    basicUser:      'usr',
    basicPass:      'pwd',
    authMode:       'oauth2',
    tokenTtlBuffer: 30,
    ...overrides,
  }
}

describe('ProtheusAuthClient — edge cases', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('token expirado no exato momento do buffer deve forçar refresh', async () => {
    mockedAxios.post = jest.fn()
      .mockResolvedValueOnce({
        data: { access_token: 'tok-1', token_type: 'Bearer', expires_in: 60 },
      })
      .mockResolvedValueOnce({
        data: { access_token: 'tok-2', token_type: 'Bearer', expires_in: 60 },
      })

    const client = new ProtheusAuthClient(makeConfig({ tokenTtlBuffer: 30 }))
    await client.getToken()

    // Avançar exatamente até expiresAt (60-30=30s)
    jest.advanceTimersByTime(30_000)

    const token = await client.getToken()
    // No exato momento do buffer, Date.now() >= expiresAt → refresh
    expect(mockedAxios.post).toHaveBeenCalledTimes(2)
    expect(token).toBe('tok-2')
  })

  it('dois getToken() simultâneos não devem disparar duas chamadas OAuth2', async () => {
    let calls = 0
    mockedAxios.post = jest.fn().mockImplementation(async () => {
      calls++
      await Promise.resolve() // yield para deixar o segundo getToken() iniciar
      return { data: { access_token: 'tok-dedup', token_type: 'Bearer', expires_in: 3600 } }
    })

    const client = new ProtheusAuthClient(makeConfig())
    const [t1, t2] = await Promise.all([client.getToken(), client.getToken()])

    expect(t1).toBe('tok-dedup')
    expect(t2).toBe('tok-dedup')
    expect(calls).toBe(1)
  })

  it('authMode inválido deve lançar erro na criação do client', () => {
    expect(() =>
      new ProtheusAuthClient(makeConfig({ authMode: 'ldap' as any })),
    ).toThrow(/authMode inválido/)
  })

  it('Protheus retorna expires_in = 0 → token nunca cacheado, sempre busca novo', async () => {
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { access_token: 'tok-ephemeral', token_type: 'Bearer', expires_in: 0 },
    })

    const client = new ProtheusAuthClient(makeConfig({ tokenTtlBuffer: 30 }))
    await client.getToken()
    await client.getToken()

    // Deve ter feito 2 chamadas pois o token com expires_in=0 nunca é cacheado
    expect(mockedAxios.post).toHaveBeenCalledTimes(2)
  })

  it('Protheus retorna 500 → UpstreamError com code PROTHEUS_AUTH_UNAVAILABLE', async () => {
    mockedAxios.post = jest.fn().mockRejectedValue({
      response: { status: 500 },
    })

    const client = new ProtheusAuthClient(makeConfig())
    await expect(client.getToken()).rejects.toMatchObject({
      name: 'UpstreamError',
      code: 'PROTHEUS_AUTH_UNAVAILABLE',
    })
  })
})
