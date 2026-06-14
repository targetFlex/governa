/**
 * metrics.spec.ts — Testes unitários para métricas customizadas do governa-core.
 *
 * Estratégia: mock completo de @opentelemetry/api para isolar dos SDKs reais.
 * O módulo metrics.ts usa apenas a API OTel (não o SDK), então os mocks são simples.
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

// ── Imports (após mocks) ──────────────────────────────────────────────────────

import {
  recordHttpRequest,
  recordAlertCreated,
  recordAuditEvent,
  recordAgentDecision,
} from './metrics'

// ── Testes ────────────────────────────────────────────────────────────────────

describe('metrics — governa-core', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('recordHttpRequest', () => {
    it('incrementa counter com atributos corretos', () => {
      recordHttpRequest({ method: 'get', route: '/pedidos', statusCode: 200, durationMs: 42 })

      expect(mockAdd).toHaveBeenCalledWith(1, {
        'http.method':      'GET',
        'http.route':       '/pedidos',
        'http.status_code': 200,
      })
    })

    it('registra histograma de duração', () => {
      recordHttpRequest({ method: 'post', route: '/alerts', statusCode: 201, durationMs: 123 })

      expect(mockRecord).toHaveBeenCalledWith(123, {
        'http.method':      'POST',
        'http.route':       '/alerts',
        'http.status_code': 201,
      })
    })

    it('normaliza método HTTP para maiúsculas', () => {
      recordHttpRequest({ method: 'delete', route: '/agents/1', statusCode: 204, durationMs: 10 })

      expect(mockAdd).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ 'http.method': 'DELETE' })
      )
    })
  })

  describe('recordAlertCreated', () => {
    it('incrementa counter com kind, severity e tenantId', () => {
      recordAlertCreated({ kind: 'POLICY_VIOLATION', severity: 'HIGH', tenantId: 'tenant-1' })

      expect(mockAdd).toHaveBeenCalledWith(1, {
        'alert.kind':     'POLICY_VIOLATION',
        'alert.severity': 'HIGH',
        'tenant.id':      'tenant-1',
      })
    })
  })

  describe('recordAuditEvent', () => {
    it('incrementa counter com kind e tenantId', () => {
      recordAuditEvent({ kind: 'AGENT_DECISION', tenantId: 'tenant-2' })

      expect(mockAdd).toHaveBeenCalledWith(1, {
        'audit.kind': 'AGENT_DECISION',
        'tenant.id':  'tenant-2',
      })
    })
  })

  describe('recordAgentDecision', () => {
    it('registra decisão "approved"', () => {
      recordAgentDecision({ outcome: 'approved', tenantId: 'tenant-3' })

      expect(mockAdd).toHaveBeenCalledWith(1, {
        'decision.outcome': 'approved',
        'tenant.id':        'tenant-3',
      })
    })

    it('registra decisão "escalated"', () => {
      recordAgentDecision({ outcome: 'escalated', tenantId: 'tenant-4' })

      expect(mockAdd).toHaveBeenCalledWith(1, {
        'decision.outcome': 'escalated',
        'tenant.id':        'tenant-4',
      })
    })
  })
})
