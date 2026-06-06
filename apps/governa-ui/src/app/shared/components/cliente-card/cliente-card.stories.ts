// ============================================================
// cliente-card.stories.ts
//
// Storybook 8 stories para ClienteCardComponent.
// O addon @storybook/addon-a11y executa axe-core em todas as
// stories automaticamente — violations exibidas no painel A11y.
// ============================================================
import type { Meta, StoryObj } from '@storybook/angular';
import { ClienteCardComponent } from './cliente-card.component';
import type { Cliente } from '../../models/cliente.model';

// ── Fixture helpers ───────────────────────────────────────────
const clienteBase: Cliente = {
  id: 'c1',
  codigo: 'CLI001',
  nome: 'Empresa Exemplo LTDA',
  tipoPessoa: 'PJ',
  documento: '12.345.678/0001-90',
  email: 'contato@empresa.com',
  telefone: '(11) 99999-9999',
  ativo: true,
  limiteCredito: 50000,
  saldoDevedor: 12500,
  moeda: 'BRL',
  criadoEm: '2024-01-01T00:00:00Z',
  atualizadoEm: '2024-01-15T00:00:00Z',
};

// ── Meta ─────────────────────────────────────────────────────
const meta: Meta<ClienteCardComponent> = {
  title: 'Shared/ClienteCard',
  component: ClienteCardComponent,
  tags: ['autodocs'],
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

/** Cliente PJ ativo com todos os campos preenchidos */
export const PJAtivo: Story = {
  name: 'PJ — Ativo',
  args: { cliente: clienteBase },
};

/** Cliente PF ativo sem telefone */
export const PFAtivo: Story = {
  name: 'PF — Ativo sem telefone',
  args: {
    cliente: {
      ...clienteBase,
      id: 'c2',
      codigo: 'CLI002',
      nome: 'Maria Oliveira',
      tipoPessoa: 'PF',
      documento: '123.456.789-00',
      email: 'maria@pessoal.com',
      telefone: null,
      limiteCredito: 10000,
      saldoDevedor: 0,
    },
  },
};

/** Cliente inativo (mostra badge vermelho + card em opacidade reduzida) */
export const Inativo: Story = {
  name: 'PJ — Inativo',
  args: {
    cliente: {
      ...clienteBase,
      id: 'c3',
      codigo: 'CLI003',
      nome: 'Empresa Desativada SA',
      ativo: false,
      saldoDevedor: 75000,
    },
  },
};

/** Saldo devedor alto — limite de crédito atingido */
export const SaldoAlto: Story = {
  name: 'PJ — Saldo devedor alto',
  args: {
    cliente: {
      ...clienteBase,
      id: 'c4',
      codigo: 'CLI004',
      nome: 'Construtora Grande LTDA',
      limiteCredito: 500000,
      saldoDevedor: 498500,
    },
  },
};
