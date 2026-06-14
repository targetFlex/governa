// ============================================================
// agente-card.stories.ts
//
// Storybook 8 stories para AgenteCardComponent.
// O addon @storybook/addon-a11y executa axe-core em todas as
// stories automaticamente — violations exibidas no painel A11y.
// ============================================================
import type { Meta, StoryObj } from '@storybook/angular';
import { AgenteCardComponent } from './agente-card.component';
import type { Agente } from '../../models/agente.model';

// ── Fixture base ──────────────────────────────────────────────

const agenteBase: Agente = {
  id:           'agente-1',
  tenantId:     'tenant-tf',
  name:         'Agente de Atendimento',
  description:  'Responde consultas de status de pedidos via integração Protheus.',
  ownerId:      'user-1',
  policyId:     'policy-consultivo',
  status:       'ACTIVE',
  modelId:      'claude-sonnet-4',
  tools:        ['read_protheus_pedido', 'read_protheus_cliente'],
  createdAt:    '2026-05-01T10:00:00Z',
  updatedAt:    '2026-06-10T08:00:00Z',
  lastActiveAt: '2026-06-13T14:30:00Z',
};

// ── Meta ──────────────────────────────────────────────────────

const meta: Meta<AgenteCardComponent> = {
  title: 'Shared/AgenteCard',
  component: AgenteCardComponent,
  tags: ['autodocs'],
  parameters: {
    a11y: {
      disable: false,
      options: {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      },
    },
    layout: 'centered',
  },
  argTypes: {
    agente:      { control: 'object' },
    emAndamento: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<AgenteCardComponent>;

// ── Stories ───────────────────────────────────────────────────

/** Agente ativo em produção — exibe botão Pausar */
export const Ativo: Story = {
  name: 'Ativo',
  args: { agente: agenteBase, emAndamento: false },
};

/** Agente pausado manualmente — exibe botão Ativar */
export const Pausado: Story = {
  name: 'Pausado',
  args: {
    agente: { ...agenteBase, id: 'agente-2', name: 'Agente Financeiro', status: 'PAUSED' },
    emAndamento: false,
  },
};

/** Agente em sandbox — ainda não promovido para produção */
export const Sandbox: Story = {
  name: 'Sandbox',
  args: {
    agente: {
      ...agenteBase,
      id:          'agente-3',
      name:        'Agente Experimental',
      description: 'Testa integração com Fluig antes de ir para produção.',
      status:      'SANDBOX',
      policyId:    null,
      lastActiveAt: null,
    },
    emAndamento: false,
  },
};

/** Agente depreciado — estado terminal, sem ações */
export const Depreciado: Story = {
  name: 'Depreciado',
  args: {
    agente: {
      ...agenteBase,
      id:     'agente-4',
      name:   'Agente v1 (legado)',
      status: 'DEPRECATED',
    },
    emAndamento: false,
  },
};

/** Ação em andamento — spinner visível no botão */
export const EmAndamento: Story = {
  name: 'Em Andamento (pausando)',
  args: { agente: agenteBase, emAndamento: true },
};
