/**
 * metrics.ts — Instrumentos de métricas customizados para governa-gateway.
 *
 * Métricas expostas:
 *   governa.gateway.protheus.requests.total    — counter de chamadas ao Protheus
 *   governa.gateway.protheus.request.duration_ms — histogram de latência
 *   governa.gateway.protheus.errors.total      — counter de erros por tipo
 */

import { metrics } from '@opentelemetry/api'

// ── Meter ─────────────────────────────────────────────────────────────────────

const meter = metrics.getMeter('governa-gateway', '0.1.0')

// ── Instrumentos ──────────────────────────────────────────────────────────────

const protheusRequestsTotal = meter.createCounter('governa.gateway.protheus.requests.total', {
  description: 'Total de chamadas realizadas à API Protheus',
  unit:        '{request}',
})

const protheusRequestDuration = meter.createHistogram('governa.gateway.protheus.request.duration_ms', {
  description: 'Latência das chamadas à API Protheus em milissegundos',
  unit:        'ms',
  advice: {
    explicitBucketBoundaries: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
  },
})

const protheusErrorsTotal = meter.createCounter('governa.gateway.protheus.errors.total', {
  description: 'Total de erros nas chamadas à API Protheus',
  unit:        '{error}',
})

// ── API pública ───────────────────────────────────────────────────────────────

export function recordProtheusRequest(opts: {
  connector:  string   // ex: 'read_pedido', 'read_cliente', 'login'
  statusCode: number
  durationMs: number
}): void {
  const attrs = {
    'protheus.connector':   opts.connector,
    'http.status_code':     opts.statusCode,
  }
  protheusRequestsTotal.add(1, attrs)
  protheusRequestDuration.record(opts.durationMs, attrs)
}

export function recordProtheusError(opts: {
  connector: string
  errorType: string   // ex: 'timeout', 'auth_failure', 'not_found', 'server_error'
}): void {
  protheusErrorsTotal.add(1, {
    'protheus.connector': opts.connector,
    'error.type':         opts.errorType,
  })
}
