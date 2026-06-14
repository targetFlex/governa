/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/infra/telemetry/jest.setup.ts'],
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts',
    '!src/infra/telemetry/jest.setup.ts',
  ],
  coverageThreshold: {
    global: {
      branches:   80,
      functions:  80,
      lines:      80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
}
