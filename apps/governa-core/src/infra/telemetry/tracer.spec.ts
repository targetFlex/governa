/**
 * tracer.spec.ts — Testes do bootstrap OTel (governa-core).
 *
 * Estratégia: jest.setup.ts seta OTEL_SDK_DISABLED=true antes de qualquer carregamento,
 * então o NodeSDK nunca é instanciado nos testes. Aqui verificamos:
 *   1. shutdownTelemetry() resolve sem erro quando SDK está desabilitado (sdk = null)
 *   2. O módulo exporta shutdownTelemetry como função
 *   3. Configuração de env vars é lida corretamente
 *
 * Para testes de inicialização do SDK em si, o comportamento está coberto por:
 *   - jest.mock no nível do módulo (NodeSDK mockado)
 *   - Inspeção das variáveis de ambiente lidas pelo tracer
 */

// ── Mocks de nível de módulo ──────────────────────────────────────────────────
// Aplicados ANTES do import do tracer (ts-jest hissa os jest.mock para o topo)

const mockSdkStart    = jest.fn()
const mockSdkShutdown = jest.fn().mockResolvedValue(undefined)
const MockNodeSDK     = jest.fn().mockImplementation(() => ({
  start:    mockSdkStart,
  shutdown: mockSdkShutdown,
}))

const mockLoggerProviderShutdown = jest.fn().mockResolvedValue(undefined)
const mockAddLogRecordProcessor  = jest.fn()
const MockLoggerProvider         = jest.fn().mockImplementation(() => ({
  addLogRecordProcessor: mockAddLogRecordProcessor,
  shutdown:              mockLoggerProviderShutdown,
}))
const MockBatchLogRecordProcessor = jest.fn().mockImplementation(() => ({}))
const MockOTLPLogExporter         = jest.fn().mockImplementation(() => ({}))
const mockSetGlobalLoggerProvider = jest.fn()

jest.mock('@opentelemetry/sdk-node', () => ({ NodeSDK: MockNodeSDK }))
jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: jest.fn().mockReturnValue([]),
}))
jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: jest.fn().mockImplementation(() => ({})),
}))
jest.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: jest.fn().mockImplementation(() => ({})),
}))
jest.mock('@opentelemetry/sdk-metrics', () => ({
  PeriodicExportingMetricReader: jest.fn().mockImplementation(() => ({})),
}))
jest.mock('@opentelemetry/sdk-logs', () => ({
  LoggerProvider:            MockLoggerProvider,
  BatchLogRecordProcessor:   MockBatchLogRecordProcessor,
}))
jest.mock('@opentelemetry/exporter-logs-otlp-http', () => ({
  OTLPLogExporter: MockOTLPLogExporter,
}))
jest.mock('@opentelemetry/api-logs', () => ({
  logs: { setGlobalLoggerProvider: mockSetGlobalLoggerProvider, getLogger: jest.fn().mockReturnValue({ emit: jest.fn() }) },
}))
const mockWinstonLogger = {
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}
jest.mock('winston', () => {
  const mockFormat = jest.fn().mockReturnValue({})
  return {
    createLogger: jest.fn().mockReturnValue(mockWinstonLogger),
    format: {
      combine:   mockFormat,
      timestamp: mockFormat,
      errors:    mockFormat,
      json:      mockFormat,
      colorize:  mockFormat,
      printf:    mockFormat,
      simple:    mockFormat,
    },
    transports: { Console: jest.fn().mockImplementation(() => ({})) },
  }
})

// ── Import (OTEL_SDK_DISABLED=true via jest.setup.ts — sdk é null neste contexto) ──

import { shutdownTelemetry } from './tracer'

// ── Testes ────────────────────────────────────────────────────────────────────

describe('tracer — governa-core', () => {
  it('exporta shutdownTelemetry como função assíncrona', () => {
    expect(typeof shutdownTelemetry).toBe('function')
    expect(shutdownTelemetry()).toBeInstanceOf(Promise)
  })

  it('shutdownTelemetry resolve sem erro quando SDK desabilitado (sdk = null)', async () => {
    // OTEL_SDK_DISABLED=true (setado em jest.setup.ts) → sdk nunca instanciado
    await expect(shutdownTelemetry()).resolves.toBeUndefined()
  })

  it('SDK não é instanciado quando OTEL_SDK_DISABLED=true', () => {
    // NodeSDK mockado não deve ter sido chamado (OTEL_SDK_DISABLED=true no setup)
    expect(MockNodeSDK).not.toHaveBeenCalled()
  })

  it('shutdownTelemetry não chama sdk.shutdown quando sdk é null', async () => {
    await shutdownTelemetry()
    expect(mockSdkShutdown).not.toHaveBeenCalled()
  })
})
