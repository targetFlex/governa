/**
 * tracer.ts — Inicialização do OpenTelemetry SDK para governa-core.
 *
 * Pilares de observabilidade:
 *   - Traces  → OTLPTraceExporter  → otel-collector → Jaeger / Datadog
 *   - Metrics → OTLPMetricExporter → otel-collector → Prometheus / Datadog
 *   - Logs    → OTLPLogExporter    → otel-collector → Loki / Datadog
 *              + Winston (auto-instrumentation bridge) → mesmo exporter
 *
 * IMPORTANTE: este módulo DEVE ser o primeiro import em server.ts para que
 * a instrumentação automática (Express, HTTP, Winston) funcione via monkey-patch.
 *
 * Variáveis de ambiente:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — URL do OTel Collector (default: http://localhost:4318)
 *   OTEL_SERVICE_NAME             — nome do serviço (default: governa-core)
 *   OTEL_TRACES_SAMPLER           — sampler (default: parentbased_always_on)
 *   OTEL_SDK_DISABLED             — desabilitar OTel por completo (default: false)
 *   LOG_LEVEL                     — nível Winston (default: info)
 */

import { NodeSDK }                              from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations }          from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter }                    from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter }                   from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader }        from '@opentelemetry/sdk-metrics'
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter }                      from '@opentelemetry/exporter-logs-otlp-http'
import { logs }                                 from '@opentelemetry/api-logs'
import winston                                  from 'winston'

// ── Configuração ──────────────────────────────────────────────────────────────

const serviceName  = process.env['OTEL_SERVICE_NAME']           ?? 'governa-core'
const otlpEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318'
const sdkDisabled  = process.env['OTEL_SDK_DISABLED'] === 'true'
const logLevel     = process.env['LOG_LEVEL'] ?? 'info'

// ── Winston Logger (sempre disponível, formato JSON estruturado) ──────────────
// Quando OTEL_SDK_DISABLED=false, a auto-instrumentação Winston do OTel
// faz bridge automático: winston.log() → OTel LoggerProvider → otel-collector.

const winstonFormat = process.env['NODE_ENV'] === 'production'
  ? winston.format.json()
  : winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
        return `${timestamp} [${serviceName}] ${level}: ${message}${metaStr}`
      }),
    )

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: serviceName },
  transports: [
    new winston.transports.Console({ format: winstonFormat }),
  ],
})

// ── OTel Log Provider ─────────────────────────────────────────────────────────

let loggerProvider: LoggerProvider | null = null

if (!sdkDisabled) {
  const logExporter = new OTLPLogExporter({ url: `${otlpEndpoint}/v1/logs` })
  loggerProvider = new LoggerProvider()
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter))
  logs.setGlobalLoggerProvider(loggerProvider)
}

// ── OTel SDK (Traces + Metrics) ───────────────────────────────────────────────

let sdk: NodeSDK | null = null

if (!sdkDisabled) {
  const traceExporter  = new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
  const metricExporter = new OTLPMetricExporter({ url: `${otlpEndpoint}/v1/metrics` })

  sdk = new NodeSDK({
    serviceName,
    traceExporter,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — sdk-metrics@1.30.1 vs sdk-node@0.53.0: private _shutdown incompatível
    metricReader: new PeriodicExportingMetricReader({
      exporter:             metricExporter,
      exportIntervalMillis: 30_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Reduz ruído: fs é muito verboso
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  })

  sdk.start()
  logger.info('[otel] SDK iniciado — traces + metrics + logs', {
    service:  serviceName,
    endpoint: otlpEndpoint,
  })
} else {
  logger.info('[otel] SDK desabilitado via OTEL_SDK_DISABLED=true')
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

export async function shutdownTelemetry(): Promise<void> {
  const errors: unknown[] = []

  if (sdk) {
    try {
      await sdk.shutdown()
    } catch (err) {
      errors.push(err)
      logger.error('[otel] Erro ao encerrar NodeSDK', { err })
    }
  }

  if (loggerProvider) {
    try {
      await loggerProvider.shutdown()
    } catch (err) {
      errors.push(err)
      logger.error('[otel] Erro ao encerrar LoggerProvider', { err })
    }
  }

  if (errors.length === 0) {
    logger.info('[otel] SDK encerrado com sucesso')
  }
}
