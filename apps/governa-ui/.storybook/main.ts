// ============================================================
// .storybook/main.ts
//
// Storybook 8 — Angular 17 (standalone components)
// Addons: essentials + a11y (axe-core via @storybook/addon-a11y)
// ============================================================
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
};

export default config;
