// Este arquivo não é um spec — é referenciado por jest.config.js como setupFile.
// Desabilita o SDK OTel para evitar conexões reais em testes unitários.
// Os specs de tracer.spec.ts fazem jest.resetModules() + jest.mock() por cima disto.
process.env['OTEL_SDK_DISABLED'] = 'true'
