/**
 * Jest config — governa-core
 *
 * Estratégia de testes (preferências #3 e #5):
 *   - Specs unitários em src/** /*.spec.ts (co-locados com o código)
 *   - Edge cases em test/edge/** /*.edge.spec.ts (isolados)
 *   - Coverage global ≥ 80% (statements, branches, functions, lines)
 *   - Naming Given/When/Then nos describe/it (BDD sem Cucumber no MVP)
 *
 * Exclusões intencionais de coverage:
 *   - tipos puros (.types.ts) e index/barrel exports
 *   - server.ts (bootstrap — coberto por testes E2E na sessão 1.5)
 *   - prisma/seed.ts (script único, não-código de produção)
 *   - infrastructure/prisma-*.ts (adapters Prisma requerem DB real — cobertos em integração 1.5)
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/?(*.)+(spec|test).ts',
    '**/test/edge/**/*.edge.spec.ts',
  ],
  // Integração exige banco real — rodar via jest.integration.config.js
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/integration/',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.types.ts',
    '!src/**/index.ts',
    '!src/server.ts',
    '!src/**/infrastructure/prisma-*.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches:   80,
      functions:  80,
      lines:      80,
    },
  },
  clearMocks: true,
  restoreMocks: true,
  verbose: false,
}
