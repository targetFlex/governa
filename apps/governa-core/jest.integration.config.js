/**
 * Jest config — testes de integração (governa-core)
 *
 * Requer banco Postgres rodando:
 *   cd governa && docker compose -f infra/docker/docker-compose.yml up -d
 *   npx prisma migrate deploy (ou db:migrate)
 *
 * Usa TEST_DATABASE_URL se definido; caso contrário, cai em DATABASE_URL do .env.
 *
 * Timeout maior (30 s) pois queries reais ao banco são mais lentas que mocks.
 * Inclui infrastructure/prisma-*.ts no coverage — aqui esses adapters têm banco real.
 *
 * Critério E1:
 *   pnpm test:integration:coverage deve mostrar os adapters Prisma cobertos.
 */

/** @type {import('jest').Config} */
module.exports = {
  preset:          'ts-jest',
  testEnvironment: 'node',
  roots:           ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/test/integration/**/*.integration.spec.ts',
  ],
  testTimeout: 30_000,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.types.ts',
    '!src/**/index.ts',
    '!src/server.ts',
    // prisma-*.ts INCLUÍDOS aqui (ao contrário da config unitária)
  ],
  coverageDirectory:  'coverage-integration',
  coverageReporters:  ['text', 'text-summary', 'lcov', 'html'],
  // Threshold menor: só adapters Prisma + services são exercitados
  coverageThreshold: {
    global: {
      statements: 60,
      branches:   50,
      functions:  60,
      lines:      60,
    },
  },
  clearMocks:    true,
  restoreMocks:  true,
  verbose:       true,
}
