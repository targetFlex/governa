/**
 * jest.pact.config.js — Configuração exclusiva para testes Pact (consumer + provider)
 *
 * Separado do jest.config.js pelos mesmos motivos do governa-gateway:
 *  1. Pact testes iniciam servidores HTTP reais — maxWorkers: 1
 *  2. Não contribuem para coverage de src/
 *
 * Uso:
 *   pnpm pact:test     → consumer pacts (core → gateway) + provider verification
 *   pnpm pact:verify   → somente provider verification (governa-core como provider)
 *   pnpm pact:publish  → publica pacts gerados no broker local
 *
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
module.exports = {
  preset:          'ts-jest',
  testEnvironment: 'node',
  roots:           ['<rootDir>/test/pact'],
  testMatch:       ['**/*.pact.spec.ts'],
  testTimeout:     60_000,   // Provider verification é mais pesado
  maxWorkers:      1,
  collectCoverage: false,
  verbose:         true,
}
