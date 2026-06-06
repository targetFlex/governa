// ============================================================
// upstream-error.handler.spec.ts
//
// Garante que o barrel re-exporta os três símbolos esperados e
// que todos eles são funcionais ao serem importados por esta via.
//
// Propósito: Istanbul conta cada re-export como uma "função".
// Sem este spec, handleAuthError permanece em 66.66% (não importado
// por nenhum conector — o auth client importa diretamente de
// protheus-errors.ts). Este spec eleva o barrel a 100%.
//
// Cobertura pendente desde sessão 2.3.
// ============================================================

import { UpstreamError, handleUpstreamError, handleAuthError } from './upstream-error.handler'

describe('upstream-error.handler (barrel re-exports)', () => {
  // ── UpstreamError ─────────────────────────────────────────

  describe('UpstreamError', () => {
    it('é instância de Error com campos tipados', () => {
      const err = new UpstreamError('PROTHEUS_NOT_FOUND', 'não encontrado', 404, 'barrel-test')
      expect(err).toBeInstanceOf(Error)
      expect(err.name).toBe('UpstreamError')
      expect(err.code).toBe('PROTHEUS_NOT_FOUND')
      expect(err.httpStatus).toBe(404)
      expect(err.source).toBe('barrel-test')
    })
  })

  // ── handleUpstreamError ───────────────────────────────────

  describe('handleUpstreamError', () => {
    it('mapeia erro HTTP 404 → PROTHEUS_NOT_FOUND', () => {
      const err = handleUpstreamError({ response: { status: 404 } }, 'connector')
      expect(err.code).toBe('PROTHEUS_NOT_FOUND')
      expect(err.httpStatus).toBe(404)
      expect(err.source).toBe('connector')
    })

    it('mapeia timeout (ECONNABORTED) → PROTHEUS_TIMEOUT', () => {
      const err = handleUpstreamError({ code: 'ECONNABORTED' }, 'connector')
      expect(err.code).toBe('PROTHEUS_TIMEOUT')
      expect(err.httpStatus).toBe(408)
    })
  })

  // ── handleAuthError ───────────────────────────────────────
  // Esta é a cobertura ausente: nenhum conector importa handleAuthError
  // por este barrel (o auth client usa caminho direto). Importar aqui
  // garante que o re-export seja exercitado e Istanbul marque 100%.

  describe('handleAuthError', () => {
    it('timeout de auth → PROTHEUS_AUTH_UNAVAILABLE com status 408', () => {
      const err = handleAuthError({ code: 'ECONNABORTED' }, 'auth')
      expect(err.code).toBe('PROTHEUS_AUTH_UNAVAILABLE')
      expect(err.httpStatus).toBe(408)
      expect(err.source).toBe('auth')
    })

    it('erro HTTP de auth (401) → PROTHEUS_AUTH_UNAVAILABLE com status 401', () => {
      const err = handleAuthError({ response: { status: 401 } }, 'auth')
      expect(err.code).toBe('PROTHEUS_AUTH_UNAVAILABLE')
      expect(err.httpStatus).toBe(401)
    })

    it('sem response (ex: rede) → PROTHEUS_AUTH_UNAVAILABLE com status 500 padrão', () => {
      const err = handleAuthError(new Error('fail'), 'auth')
      expect(err.code).toBe('PROTHEUS_AUTH_UNAVAILABLE')
      expect(err.httpStatus).toBe(500)
    })

    it('timeout via ERR_NETWORK → PROTHEUS_AUTH_UNAVAILABLE com status 408', () => {
      const err = handleAuthError({ code: 'ERR_NETWORK' }, 'auth')
      expect(err.code).toBe('PROTHEUS_AUTH_UNAVAILABLE')
      expect(err.httpStatus).toBe(408)
    })
  })
})
