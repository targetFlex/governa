// ============================================================
// cliente-card.stories.ts
//
// Storybook 8 stories para ClienteCardComponent.
// O addon @storybook/addon-a11y executa axe-core em todas as
// stories automaticamente — violations exibidas no painel A11y.
//
// HttpClientModule é necessário porque o card injeta
// ClientePiiService (HttpClient) para a revelação sob demanda —
// sem backend real no Storybook, o botão "Revelar dados" fica
// em loading indefinido nas stories (comportamento esperado).
// ============================================================
import type { Meta, StoryObj } from '@storybook/angular';
import { HttpClientModule } from '@angular/common/http';
import { moduleMetadata } from '@storybook/angular';
import { ClienteCardComponent } from './cliente-card.component';
import type { Cliente } from '../../models/cliente.model';

// ── Fixture helpers ───────────────────────────────────────────
const clienteBase: Cliente = {
  clienteId: 'CLI001',
  loja: '01',
  nomeToken: 'a'.repeat(64),
  documentoToken: 'b'.repeat(64),
  enderecoToken: 'c'.repeat(64),
  emailToken: 'd'.repeat(64),
  telefoneToken: 'e'.repeat(64),
  bloqueado: false,
};

// ── Meta ─────────────────────────────────────────────────────
const meta: Meta<ClienteCardComponent> = {
  title: 'Shared/ClienteCard',
  component: ClienteCardComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [HttpClientModule] })],
  parameters: {
    a11y: {
      disable: false,
      // Garante que axe roda com WCAG 2.1 AA
      options: {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      },
    },
    layout: 'centered',
  },
  argTypes: {
    cliente: { control: 'object' },
  },
};

export default meta;
type Story = StoryObj<ClienteCardComponent>;

// ── Stories ───────────────────────────────────────────────────

/** Cliente ativo — PII oculta por padrão, atrás do botão "Revelar dados" */
export const Ativo: Story = {
  name: 'Ativo',
  args: { cliente: clienteBase },
};

/** Cliente ativo sem telefone cadastrado */
export const SemTelefone: Story = {
  name: 'Ativo — sem telefone',
  args: {
    cliente: {
      ...clienteBase,
      clienteId: 'CLI002',
      loja: '01',
      telefoneToken: null,
    },
  },
};

/** Cliente bloqueado (mostra badge vermelho + card em opacidade reduzida) */
export const Bloqueado: Story = {
  name: 'Bloqueado',
  args: {
    cliente: {
      ...clienteBase,
      clienteId: 'CLI003',
      loja: '02',
      bloqueado: true,
    },
  },
};
