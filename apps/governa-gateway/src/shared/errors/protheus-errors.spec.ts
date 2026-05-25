// ============================================================
// protheus-errors.spec.ts — Testes do dicionário de erros upstream
// ============================================================
import { UpstreamError, handleUpstreamError, handleAuthError } from './protheus-errors'

describe('UpstreamError', () => {
  it('é instância de Error', () => {
    const err = new UpstreamError('CODE', 'msg', 500, 'test')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('UpstreamError')
    expect(err.message).toBe('msg')
    expect(err.code).toBe('CODE')
    expect(err.httpStatus).toBe(500)
    expect(err.source).toBe('test')
  })
})

describe('handleUpstreamError', () => {
  it('mapeia 400 → PROTHEUS_BAD_REQUEST', () => {
    const err = handleUpstreamError({ response: { status: 400 } }, 'conn')
    expect(err.code).toBe('PROTHEUS_BAD_REQUEST')
    expect(err.httpStatus).toBe(400)
    expect(err.source).toBe('conn')
  })

  it('mapeia 401 → PROTHEUS_UNAUTHORIZED', () => {
    const err = handleUpstreamError({ response: { status: 401 } }, 'conn')
    expect(err.code).toBe('PROTHEUS_UNAUTHORIZED')
  })

  it('mapeia 403 → PROTHEUS_FORBIDDEN', () => {
    const err = handleUpstreamError({ response: { status: 403 } }, 'conn')
    expect(err.code).toBe('PROTHEUS_FORBIDDEN')
  })

  it('mapeia 404 → PROTHEUS_NOT_FOUND', () => {
    const err = handleUpstreamError({ response: { status: 404 } }, 'conn')
    expect(err.code).toBe('PROTHEUS_NOT_FOUND')
  })

  it('mapeia 429 → PROTHEUS_RATE_LIMITED', () => {
    const err = handleUpstreamError({ response: { status: 429 } }, 'conn')
    expect(err.code).toBe('PROTHEUS_RATE_LIMITED')
  })

  it('mapeia 500 → PROTHEUS_INTERNAL_ERROR', () => {
    const err = handleUpstreamError({ response: { status: 500 } }, 'conn')
    expect(err.code).toBe('PROTHEUS_INTERNAL_ERROR')
  })

  it('mapeia 503 → PROTHEUS_UNAVAILABLE', () => {
    const err = handleUpstreamError({ response: { status: 503 } }, 'conn')
    expect(err.code).toBe('PROTHEUS_UNAVAILABLE')
  })

  it('mapeia código HTTP desconhecido → PROTHEUS_UNKNOWN_ERROR', () => {
    const err = handleUpstreamError({ response: { status: 418 } }, 'conn')
    expect(err.code).toBe('PROTHEUS_UNKNOWN_ERROR')
    expect(err.httpStatus).toBe(418)
  })

  it('timeout Axios (ECONNABORTED) → PROTHEUS_TIMEOUT', () => {
    const err = handleUpstreamError({ code: 'ECONNABORTED' }, 'conn')
    expect(err.code).toBe('PROTHEUS_TIMEOUT')
    expect(err.httpStatus).toBe(408)
  })

  it('timeout Axios (ERR_NETWORK) → PROTHEUS_TIMEOUT', () => {
    const err = handleUpstreamError({ code: 'ERR_NETWORK' }, 'conn')
    expect(err.code).toBe('PROTHEUS_TIMEOUT')
  })

  it('erro sem response (ex: network error) → PROTHEUS_UNKNOWN_ERROR com status 0', () => {
    const err = handleUpstreamError(new Error('network fail'), 'conn')
    expect(err.code).toBe('PROTHEUS_UNKNOWN_ERROR')
    expect(err.httpStatus).toBe(0)
  })
})

describe('handleAuthError', () => {
  it('timeout → PROTHEUS_AUTH_UNAVAILABLE com status 408', () => {
    const err = handleAuthError({ code: 'ECONNABORTED' }, 'auth')
    expect(err.code).toBe('PROTHEUS_AUTH_UNAVAILABLE')
    expect(err.httpStatus).toBe(408)
  })

  it('HTTP 500 → PROTHEUS_AUTH_UNAVAILABLE com status 500', () => {
    const err = handleAuthError({ response: { status: 500 } }, 'auth')
    expect(err.code).toBe('PROTHEUS_AUTH_UNAVAILABLE')
    expect(err.httpStatus).toBe(500)
  })

  it('sem response → PROTHEUS_AUTH_UNAVAILABLE com status 500 padrão', () => {
    const err = handleAuthError(new Error('fail'), 'auth')
    expect(err.code).toBe('PROTHEUS_AUTH_UNAVAILABLE')
    expect(err.httpStatus).toBe(500)
  })
})
