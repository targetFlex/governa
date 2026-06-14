/**
 * metrics.ts — Instrumentos de métricas customizados para governa-core.
 *
 * Exporta funções de conveniência para registrar métricas de negócio e
 * infraestrutura. Todos os instrumentos usam @opentelemetry/api — se o
 * SDK não estiver inicializado, as operações são no-op automaticamente.
 *
 * Métricas expostas:
 *   governa.http.requests.total          — counter por método/rota/status
 *   governa.http.request.duration_ms     — histogram de latência HTTP
 *   governa.alerts.created.total         — counter de alertas criados por kind/severity
 *   governa.audit.events.total           — counter de eventos de audit por kind
 *   governa.agent.decisions.total        — counter de decisões do agente (approved/escalated)
 */

import { metrics } from '@opentelemetry/api'

// ── Meter ─────────────────────────────────────────────────────────────────────

const meter = metrics.getMeter('governa-core', '0.1.0')

// ── Instrumentos ──────────────────────────────────────────────────────────────

const httpRequestsTotal = meter.createCounter('governa.http.requests.total', {
  description: 'Total de requisições HTTP recebidas pelo governa-core',
  unit:        '{request}',
})

const httpRequestDuration = meter.createHistogram('governa.http.request.duration_ms', {
  description: 'Latência das requisições HTTP em milissegundos',
  unit:        'ms',
  advice: {
    explicitBucketBoundaries: [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000],
  },
})

const alertsCreatedTotal = meter.createCounter('governa.alerts.created.total', {
  description: 'Total de alertas criados',
  unit:        '{alert}',
})

const auditEventsTotal = meter.createCounter('governa.audit.events.total', {
  description: 'Total de eventos de audit trail gravados',
  unit:        '{event}',
})

const agentDecisionsTotal = meter.createCounter('governa.agent.decisions.total', {
  description: 'Total de decisões tomadas pelo agente (approved / escalated)',
  unit:        '{decision}',
})

// ── API pública ───────────────────────────────────────────────────────────────

export function recordHttpRequest(opts: {
  method:     string
  route:      string
  statusCode: number
  durationMs: number
}): void {
  const attrs = {
    'http.method':      opts.method.toUpperCase(),
    'http.route':       opts.route,
    'http.status_code': opts.statusCode,
  }
  httpRequestsTotal.add(1, attrs)
  httpRequestDuration.record(opts.durationMs, attrs)
}

export function recordAlertCreated(opts: {
  kind:     string
  severity: string
  tenantId: string
}): void {
  alertsCreatedTotal.add(1, {
    'alert.kind':     opts.kind,
    'alert.severity': opts.severity,
    'tenant.id':      opts.tenantId,
  })
}

export function recordAuditEvent(opts: {
  kind:     string
  tenantId: string
}): void {
  auditEventsTotal.add(1, {
    'audit.kind': opts.kind,
    'tenant.id':  opts.tenantId,
  })
}

export function recordAgentDecision(opts: {
  outcome:  'approved' | 'escalated'
  tenantId: string
}): void {
  agentDecisionsTotal.add(1, {
    'decision.outcome': opts.outcome,
    'tenant.id':        opts.tenantId,
  })
}
