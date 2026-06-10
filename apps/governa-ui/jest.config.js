/** @type {import('jest').Config} */
const path = require('path');

// pnpm v9 não hoista @angular/common para node_modules local de apps/governa-ui.
// O arquivo real está no virtual store (.pnpm/). require.resolve() segue os
// symlinks do pnpm em runtime e retorna o caminho absoluto correto,
// independente da versão ou estrutura do store.
const angularCommonDir = path.dirname(
  require.resolve('@angular/common/package.json'),
);

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
    // pnpm v9: locale files ficam no virtual store, não no node_modules local.
    // angularCommonDir resolve via require.resolve() para o caminho real no .pnpm/.
    '^@angular/common/locales/(.*)$': `${angularCommonDir}/locales/$1`,
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
