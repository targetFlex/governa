/**
 * tracer.spec.ts — Testes unitários para o bootstrap do SDK OTel (governa-core).
 *
 * Estratégia: mock do NodeSDK para verificar que o SDK é iniciado com os
 * parâmetros corretos a partir das variáveis de ambiente.
 */

// ── Mocks ───────────────────────────────────────────────────────────────────────

const mockSdkStart    = jest.fn()
const mockSdkShutdown = jest.fn().mockResolvedValue(undefined)

jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    start:    mockSdkStart,
    shutdown: mockSdkShutdown,
  })),
}))

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

// ── Testes ────────────────────────────────────────────────────────────────────

describe('tracer — governa-core', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('inicializa NodeSDK com service name padrão quando OTEL_SERVICE_NAME não definido', async () => {
    delete process.env['OTEL_SERVICE_NAME']
    delete process.env['OTEL_SDK_DISABLED']

    jest.mock('@opentelemetry/sdk-node', () => ({
      NodeSDK: jest.fn().mockImplementation(() => ({
        start:    mockSdkStart,
        shutdown: mockSdkShutdown,
      })),
    }))
    jest.mock('@opentelemetry/auto-instrumentations-node', () => ({ getNodeAutoInstrumentations: jest.fn().mockReturnValue([]) }))
    jest.mock('@opentelemetry/exporter-trace-otlp-http',   () => ({ OTLPTraceExporter: jest.fn().mockImplementation(() => ({})) }))
    jest.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({ OTLPMetricExporter: jest.fn().mockImplementation(() => ({})) }))
    jest.mock('@opentelemetry/sdk-metrics',                () => ({ PeriodicExportingMetricReader: jest.fn().mockImplementation(() => ({})) }))

    await import('./tracer')

    const { NodeSDK: MockedSDK } = await import('@opentelemetry/sdk-node')
    expect(MockedSDK).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: 'governa-core' })
    )
  })

  it('usa OTEL_SERVICE_NAME quando definido', async () => {
    process.env['OTEL_SERVICE_NAME'] = 'my-service'
    delete process.env['OTEL_SDK_DISABLED']

    jest.mock('@opentelemetry/sdk-node', () => ({
      NodeSDK: jest.fn().mockImplementation(() => ({
        start:    mockSdkStart,
        shutdown: mockSdkShutdown,
      })),
    }))
    jest.mock('@opentelemetry/auto-instrumentations-node', () => ({ getNodeAutoInstrumentations: jest.fn().mockReturnValue([]) }))
    jest.mock('@opentelemetry/exporter-trace-otlp-http',   () => ({ OTLPTraceExporter: jest.fn().mockImplementation(() => ({})) }))
    jest.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({ OTLPMetricExporter: jest.fn().mockImplementation(() => ({})) }))
    jest.mock('@opentelemetry/sdk-metrics',                () => ({ PeriodicExportingMetricReader: jest.fn().mockImplementation(() => ({})) }))

    await import('./tracer')

    const { NodeSDK: MockedSDK } = await import('@opentelemetry/sdk-node')
    expect(MockedSDK).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: 'my-service' })
    )
  })

  it('não instancia NodeSDK quando OTEL_SDK_DISABLED=true', async () => {
    process.env['OTEL_SDK_DISABLED'] = 'true'

    jest.mock('@opentelemetry/sdk-node', () => ({
      NodeSDK: jest.fn().mockImplementation(() => ({
        start:    mockSdkStart,
        shutdown: mockSdkShutdown,
      })),
    }))
    jest.mock('@opentelemetry/auto-instrumentations-node', () => ({ getNodeAutoInstrumentations: jest.fn().mockReturnValue([]) }))
    jest.mock('@opentelemetry/exporter-trace-otlp-http',   () => ({ OTLPTraceExporter: jest.fn().mockImplementation(() => ({})) }))
    jest.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({ OTLPMetricExporter: jest.fn().mockImplementation(() => ({})) }))
    jest.mock('@opentelemetry/sdk-metrics',                () => ({ PeriodicExportingMetricReader: jest.fn().mockImplementation(() => ({})) }))

    await import('./tracer')

    const { NodeSDK: MockedSDK } = await import('@opentelemetry/sdk-node')
    expect(MockedSDK).not.toHaveBeenCalled()
  })

  it('shutdownTelemetry resolve sem erro quando SDK não foi iniciado', async () => {
    process.env['OTEL_SDK_DISABLED'] = 'true'

    jest.mock('@opentelemetry/sdk-node', () => ({
      NodeSDK: jest.fn().mockImplementation(() => ({
        start:    mockSdkStart,
        shutdown: mockSdkShutdown,
      })),
    }))
    jest.mock('@opentelemetry/auto-instrumentations-node', () => ({ getNodeAutoInstrumentations: jest.fn().mockReturnValue([]) }))
    jest.mock('@opentelemetry/exporter-trace-otlp-http',   () => ({ OTLPTraceExporter: jest.fn().mockImplementation(() => ({})) }))
    jest.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({ OTLPMetricExporter: jest.fn().mockImplementation(() => ({})) }))
    jest.mock('@opentelemetry/sdk-metrics',                () => ({ PeriodicExportingMetricReader: jest.fn().mockImplementation(() => ({})) }))

    const { shutdownTelemetry } = await import('./tracer')
    await expect(shutdownTelemetry()).resolves.toBeUndefined()
    expect(mockSdkShutdown).not.toHaveBeenCalled()
  })
})
