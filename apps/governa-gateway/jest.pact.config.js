/**
 * jest.pact.config.js — Configuração exclusiva para testes Pact (consumer + provider)
 *
 * Separado do jest.config.js por dois motivos:
 *  1. Pact testes iniciam servidores HTTP reais (portas) — nunca paralelizar
 *  2. Não contribuem para coverage de src/ (são testes de contrato, não de lógica)
 *
 * Uso:
 *   pnpm pact:test      → consumer pacts (gera pact files em test/pact/pacts/)
 *   pnpm pact:verify    → provider verification (lê pacts do broker)
 *   pnpm pact:publish   → publica pacts gerados no broker local
 *
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
module.exports = {
  preset:          'ts-jest',
  testEnvironment: 'node',
  roots:           ['<rootDir>/test/pact'],
  testMatch:       ['**/*.pact.spec.ts'],
  testTimeout:     30_000,   // Pact mock server setup pode demorar
  maxWorkers:      1,        // Portas de rede — nunca paralelizar
  collectCoverage: false,    // Contratos não contribuem para coverage de src/
  verbose:         true,
}
