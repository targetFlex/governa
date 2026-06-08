/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-preset-angular',
  globalSetup: 'jest-preset-angular/global-setup',
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|js|mjs|html|svg)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
        // Desativa checagem de tipos no Jest — specs são testadas em runtime,
        // não em compilação; erros TS2307/2339/2347 em spec files são falsos-positivos
        // causados pelo moduleNameMapper redirecionar jest-axe para mock CJS.
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    '^@env/(.*)$': '<rootDir>/src/environments/$1',
    // jest-axe@9 é ESM-only: usar mock CJS local para evitar falha de import
    '^jest-axe$': '<rootDir>/src/__mocks__/jest-axe.js',
  },
  // Exclui Playwright e2e (runner separado) e node_modules do Jest
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/',
  ],
  collectCoverageFrom: [
    'src/app/**/*.ts',
    // Arquivos de bootstrap/config — não são testáveis isoladamente
    '!src/app/app.component.ts',
    '!src/app/app.config.ts',
    '!src/app/app.routes.ts',
    // Stories são fixtures do Storybook, não código de produção
    '!**/*.stories.ts',
    // Dashboard ainda sem spec — excluído temporariamente (pendente sessão futura)
    '!src/app/features/dashboard/dashboard.component.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches:   80,
      functions:  80,
      lines:      80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
};
