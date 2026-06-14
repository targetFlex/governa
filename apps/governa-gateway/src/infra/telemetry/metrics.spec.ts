/**
 * metrics.spec.ts — Testes unitários para métricas customizadas do governa-gateway.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAdd    = jest.fn()
const mockRecord = jest.fn()

const mockCounter   = { add: mockAdd }
const mockHistogram = { record: mockRecord }

const mockMeter = {
  createCounter:   jest.fn().mockReturnValue(mockCounter),
  createHistogram: jest.fn().mockReturnValue(mockHistogram),
}

jest.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: jest.fn().mockReturnValue(mockMeter),
  },
}))

// ── Imports ───────────────────────────────────────────────────────────────────

import { recordProtheusRequest, recordProtheusError } from './metrics'

// ── Testes ────────────────────────────────────────────────────────────────────

describe('metrics — governa-gateway', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('recordProtheusRequest', () => {
    it('incrementa counter com connector e statusCode', () => {
      recordProtheusRequest({ connector: 'read_pedido', statusCode: 200, durationMs: 150 })

      expect(mockAdd).toHaveBeenCalledWith(1, {
        'protheus.connector': 'read_pedido',
        'http.status_code':   200,
      })
    })

    it('registra histograma de duração', () => {
      recordProtheusRequest({ connector: 'read_cliente', statusCode: 200, durationMs: 300 })

      expect(mockRecord).toHaveBeenCalledWith(300, {
        'protheus.connector': 'read_cliente',
        'http.status_code':   200,
      })
    })

    it('registra status 4xx sem lançar exceção', () => {
      expect(() =>
        recordProtheusRequest({ connector: 'login', statusCode: 401, durationMs: 50 })
      ).not.toThrow()

      expect(mockAdd).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ 'http.status_code': 401 })
      )
    })
  })

  describe('recordProtheusError', () => {
    it('registra erro de timeout', () => {
      recordProtheusError({ connector: 'read_pedido', errorType: 'timeout' })

      expect(mockAdd).toHaveBeenCalledWith(1, {
        'protheus.connector': 'read_pedido',
        'error.type':         'timeout',
      })
    })

    it('registra erro de auth_failure', () => {
      recordProtheusError({ connector: 'login', errorType: 'auth_failure' })

      expect(mockAdd).toHaveBeenCalledWith(1, {
        'protheus.connector': 'login',
        'error.type':         'auth_failure',
      })
    })

    it('registra erro de server_error', () => {
      recordProtheusError({ connector: 'read_cliente', errorType: 'server_error' })

      expect(mockAdd).toHaveBeenCalledWith(1, {
        'protheus.connector': 'read_cliente',
        'error.type':         'server_error',
      })
    })
  })
})
