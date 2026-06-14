// Declaração de tipos local para jest-axe@9.x
// O pacote não distribui @types/jest-axe nem bundled types.
declare module 'jest-axe' {
  export interface AxeResults {
    violations: AxeViolation[];
    toolOptions?: { impactLevels?: string[] };
    [key: string]: unknown;
  }

  export interface AxeViolation {
    id: string;
    impact: string | null;
    help: string;
    helpUrl: string;
    nodes: AxeNode[];
    [key: string]: unknown;
  }

  export interface AxeNode {
    target: string[];
    html: string;
    failureSummary?: string;
    [key: string]: unknown;
  }

  export interface AxeRunOptions {
    runOnly?: { type: string; values: string[] };
    [key: string]: unknown;
  }

  export function configureAxe(options?: Record<string, unknown>): typeof axe;

  export function axe(
    html: Element | string,
    options?: AxeRunOptions,
  ): Promise<AxeResults>;

  export const toHaveNoViolations: {
    toHaveNoViolations(results: AxeResults): jest.CustomMatcherResult;
  };
}
