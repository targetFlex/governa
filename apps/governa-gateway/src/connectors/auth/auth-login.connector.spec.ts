// ============================================================
// auth-login.connector.spec.ts
//
// Testes unitários do ProtheusLoginConnector.
// axios mockado — sem Protheus real.
//
// Casos cobertos:
//   AL-1: credenciais válidas     → LoginResult com token e expiresIn
//   AL-2: 401 Protheus            → UpstreamError PROTHEUS_UNAUTHORIZED
//   AL-3: 500 Protheus            → UpstreamError PROTHEUS_INTERNAL_ERROR
//   AL-4: timeout axios           → UpstreamError PROTHEUS_TIMEOUT
//   AL-5: parâmetros enviados corretamente ao Protheus
// ============================================================

import axios from 'axios'
import { ProtheusLoginConnector } from './auth-login.connector'
import { UpstreamError } from '../../shared/errors/protheus-errors'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

const BASE_URL = 'https://protheus.test/rest'

describe('ProtheusLoginConnector', () => {
  let connector: ProtheusLoginConnector

  beforeEach(() => {
    jest.clearAllMocks()
    connector = new ProtheusLoginConnector(BASE_URL)
  })

  // ── AL-1: credenciais válidas ─────────────────────────────

  it('AL-1: credenciais válidas → retorna token e expiresIn', async () => {
    mockedAxios.post = jest.fn().mockResolvedValueOnce({
      data: { access_token: 'tok-abc123', expires_in: 3600 },
    })

    const result = await connector.execute({
      email:    'admin@empresa.com',
      password: 's3cr3t',
    })

    expect(result.token).toBe('tok-abc123')
    expect(result.expiresIn).toBe(3600)
  })

  // ── AL-2: 401 Protheus → PROTHEUS_UNAUTHORIZED ────────────

  it('AL-2: Protheus retorna 401 → UpstreamError PROTHEUS_UNAUTHORIZED', async () => {
    mockedAxios.post = jest.fn().mockRejectedValueOnce({
      response: { status: 401 },
    })

    await expect(
      connector.execute({ email: 'user@empresa.com', password: 'wrong' }),
    ).rejects.toMatchObject({
      name:       'UpstreamError',
      code:       'PROTHEUS_UNAUTHORIZED',
      httpStatus: 401,
      source:     'auth_login',
    })
  })

  // ── AL-3: 500 Protheus → PROTHEUS_INTERNAL_ERROR ──────────

  it('AL-3: Protheus retorna 500 → UpstreamError PROTHEUS_INTERNAL_ERROR', async () => {
    mockedAxios.post = jest.fn().mockRejectedValueOnce({
      response: { status: 500 },
    })

    await expect(
      connector.execute({ email: 'admin@empresa.com', password: 's3cr3t' }),
    ).rejects.toMatchObject({
      name: 'UpstreamError',
      code: 'PROTHEUS_INTERNAL_ERROR',
    })
  })

  // ── AL-4: timeout → PROTHEUS_TIMEOUT ─────────────────────

  it('AL-4: timeout axios → UpstreamError PROTHEUS_TIMEOUT', async () => {
    mockedAxios.post = jest.fn().mockRejectedValueOnce({
      code: 'ECONNABORTED',
    })

    await expect(
      connector.execute({ email: 'admin@empresa.com', password: 's3cr3t' }),
    ).rejects.toMatchObject({
      name: 'UpstreamError',
      code: 'PROTHEUS_TIMEOUT',
    })
  })

  // ── AL-5: parâmetros enviados corretamente ────────────────

  it('AL-5: chama o endpoint correto com grant_type=password', async () => {
    mockedAxios.post = jest.fn().mockResolvedValueOnce({
      data: { access_token: 'tok-x', expires_in: 1800 },
    })

    await connector.execute({ email: 'fabio@empresa.com', password: 'abc123' })

    expect(mockedAxios.post).toHaveBeenCalledWith(
      `${BASE_URL}/oauth2/token`,
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    )

    // Verificar os campos do body
    const body = mockedAxios.post.mock.calls[0][1] as URLSearchParams
    expect(body.get('grant_type')).toBe('password')
    expect(body.get('username')).toBe('fabio@empresa.com')
    expect(body.get('password')).toBe('abc123')
  })

  // ── AL-6: erro instância de UpstreamError ─────────────────

  it('AL-6: erro lançado é instância de UpstreamError', async () => {
    mockedAxios.post = jest.fn().mockRejectedValueOnce({
      response: { status: 403 },
    })

    try {
      await connector.execute({ email: 'u@e.com', password: 'p' })
      fail('deveria ter lançado')
    } catch (err) {
      expect(err).toBeInstanceOf(UpstreamError)
    }
  })
})
