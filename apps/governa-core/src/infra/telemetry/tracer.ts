/**
 * tracer.ts — Inicialização do OpenTelemetry SDK para governa-core.
 *
 * IMPORTANTE: este módulo DEVE ser importado antes de qualquer outro
 * (primeiro import em server.ts) para que a instrumentação automática
 * do Express/HTTP funcione corretamente via monkey-patching.
 *
 * Configuração via variáveis de ambiente:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — URL do OTel Collector (default: http://localhost:4318)
 *   OTEL_SERVICE_NAME             — nome do serviço (default: governa-core)
 *   OTEL_TRACES_SAMPLER           — sampler (default: parentbased_always_on)
 *   OTEL_SDK_DISABLED             — desabilitar OTel (default: false)
 */

import { NodeSDK }                           from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations }       from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter }                 from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter }                from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader }     from '@opentelemetry/sdk-metrics'

// ── Configuração ──────────────────────────────────────────────────────────────

const serviceName     = process.env['OTEL_SERVICE_NAME']            ?? 'governa-core'
const otlpEndpoint    = process.env['OTEL_EXPORTER_OTLP_ENDPOINT']  ?? 'http://localhost:4318'
const sdkDisabled     = process.env['OTEL_SDK_DISABLED'] === 'true'

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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — sdk-metrics@1.30.1 vs sdk-node@0.53.0: private _shutdown incompatível
    metricReader: new PeriodicExportingMetricReader({
      exporter:        metricExporter,
      exportIntervalMillis: 30_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Reduz ruído: desativa instrumentação de fs (muito verbosa)
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  })

  sdk.start()
  console.log(`[governa-core][otel] SDK iniciado — service: ${serviceName}, endpoint: ${otlpEndpoint}`)
} else {
  console.log('[governa-core][otel] SDK desabilitado via OTEL_SDK_DISABLED=true')
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown()
      console.log('[governa-core][otel] SDK encerrado com sucesso')
    } catch (err) {
      console.error('[governa-core][otel] Erro ao encerrar SDK:', err)
    }
  }
}
