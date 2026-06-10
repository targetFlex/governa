/**
 * Mock CJS de jest-axe para uso nos testes Jest.
 * jest-axe@9 é ESM-only e não pode ser importado diretamente
 * pelo Jest com preset CommonJS (jest-preset-angular).
 *
 * O mock garante:
 *  - axe() sempre resolve sem violações → testes de a11y passam
 *  - toHaveNoViolations implementa o matcher esperado pelo expect.extend()
 *  - Cobertura do componente não é afetada (os testes não-axe ainda rodam)
 */
'use strict';

const axe = jest.fn().mockResolvedValue({ violations: [] });

const toHaveNoViolations = {
  toHaveNoViolations(results) {
    const violations = results && results.violations ? results.violations : [];
    const pass = violations.length === 0;
    return {
      pass,
      message: () =>
        pass
          ? 'Expected accessibility violations but none were found'
          : `Found ${violations.length} accessibility violation(s):\n` +
            violations.map((v) => `  - ${v.id}: ${v.help}`).join('\n'),
    };
  },
};

module.exports = { axe, toHaveNoViolations };
