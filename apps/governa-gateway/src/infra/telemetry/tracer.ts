/**
 * tracer.ts — Inicialização do OpenTelemetry SDK para governa-gateway.
 *
 * IMPORTANTE: deve ser o primeiro import em server.ts.
 *
 * Configuração via variáveis de ambiente:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — URL do OTel Collector (default: http://localhost:4318)
 *   OTEL_SERVICE_NAME             — nome do serviço (default: governa-gateway)
 *   OTEL_SDK_DISABLED             — desabilitar OTel (default: false)
 */

import { NodeSDK }                           from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations }       from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter }                 from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter }                from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader }     from '@opentelemetry/sdk-metrics'

// ── Configuração ──────────────────────────────────────────────────────────────

const serviceName  = process.env['OTEL_SERVICE_NAME']            ?? 'governa-gateway'
const otlpEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT']  ?? 'http://localhost:4318'
const sdkDisabled  = process.env['OTEL_SDK_DISABLED'] === 'true'

// ── SDK ───────────────────────────────────────────────────────────────────────

let sdk: NodeSDK | null = null

if (!sdkDisabled) {
  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  })

  const metricExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`,
  })

  sdk = new NodeSDK({
    serviceName,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter:        metricExporter,
      exportIntervalMillis: 30_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  })

  sdk.start()
  console.log(`[governa-gateway][otel] SDK iniciado — service: ${serviceName}, endpoint: ${otlpEndpoint}`)
} else {
  console.log('[governa-gateway][otel] SDK desabilitado via OTEL_SDK_DISABLED=true')
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown()
      console.log('[governa-gateway][otel] SDK encerrado com sucesso')
    } catch (err) {
      console.error('[governa-gateway][otel] Erro ao encerrar SDK:', err)
    }
  }
}
