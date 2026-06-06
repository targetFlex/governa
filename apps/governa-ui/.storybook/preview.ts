// ============================================================
// .storybook/preview.ts
//
// Configuração global de preview + parâmetros de a11y.
// WCAG 2.1 AA: todas as stories rodam axe-core automaticamente
// via @storybook/addon-a11y.
// ============================================================
import type { Preview } from '@storybook/angular';
import { applicationConfig } from '@angular/core';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

const preview: Preview = {
  decorators: [
    applicationConfig({
      providers: [
        provideHttpClient(),
        provideAnimations(),
      ],
    }),
  ],
  parameters: {
    a11y: {
      // Roda axe-core com standard WCAG 2.1 AA
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'label',          enabled: true },
          { id: 'landmark-one-main', enabled: true },
        ],
      },
      options: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
