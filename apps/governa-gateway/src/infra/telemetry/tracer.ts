/**
 * tracer.ts — Inicialização do OpenTelemetry SDK para governa-gateway.
 *
 * Pilares de observabilidade:
 *   - Traces  → OTLPTraceExporter  → otel-collector
 *   - Metrics → OTLPMetricExporter → otel-collector
 *   - Logs    → OTLPLogExporter    → otel-collector (via logger exportado abaixo)
 *
 * IMPORTANTE: deve ser o primeiro import em server.ts.
 *
 * Variáveis de ambiente:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — URL do OTel Collector (default: http://localhost:4318)
 *   OTEL_SERVICE_NAME             — nome do serviço (default: governa-gateway)
 *   OTEL_SDK_DISABLED             — desabilitar OTel (default: false)
 *   LOG_LEVEL                     — debug | info | warn | error (default: info)
 */

import { NodeSDK }                              from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations }          from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter }                    from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter }                   from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader }        from '@opentelemetry/sdk-metrics'
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter }                      from '@opentelemetry/exporter-logs-otlp-http'
import { logs, SeverityNumber }                 from '@opentelemetry/api-logs'

// ── Configuração ──────────────────────────────────────────────────────────────

const serviceName  = process.env['OTEL_SERVICE_NAME']           ?? 'governa-gateway'
const otlpEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318'
const sdkDisabled  = process.env['OTEL_SDK_DISABLED'] === 'true'
const logLevel     = process.env['LOG_LEVEL'] ?? 'info'

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = LOG_LEVELS[logLevel as keyof typeof LOG_LEVELS] ?? LOG_LEVELS.info

// ── Logger estruturado (console JSON + OTel OTLP) ─────────────────────────────

const SEVERITY: Record<string, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info:  SeverityNumber.INFO,
  warn:  SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
}

type LogLevel  = 'debug' | 'info' | 'warn' | 'error'
type LogFields = Record<string, unknown>

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  if (LOG_LEVELS[level] < currentLevel) return

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: serviceName,
    message,
    ...fields,
  }

  // Console (sempre)
  const consoleFn = level === 'error' ? console.error
    : level === 'warn'  ? console.warn
    : console.log
  consoleFn(JSON.stringify(entry))

  // OTel Logs API (quando habilitado)
  const otelLogger = logs.getLogger(serviceName)
  otelLogger.emit({
    severityNumber: SEVERITY[level] ?? SeverityNumber.INFO,
    severityText:   level.toUpperCase(),
    body:           message,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attributes:     (fields ?? {}) as any,
  })
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit('debug', msg, fields),
  info:  (msg: string, fields?: LogFields) => emit('info',  msg, fields),
  warn:  (msg: string, fields?: LogFields) => emit('warn',  msg, fields),
  error: (msg: string, fields?: LogFields) => emit('error', msg, fields),
}

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
      logger.error('[otel] Erro ao encerrar NodeSDK', { err: String(err) })
    }
  }

  if (loggerProvider) {
    try {
      await loggerProvider.shutdown()
    } catch (err) {
      errors.push(err)
      logger.error('[otel] Erro ao encerrar LoggerProvider', { err: String(err) })
    }
  }

  if (errors.length === 0) {
    logger.info('[otel] SDK encerrado com sucesso')
  }
}
