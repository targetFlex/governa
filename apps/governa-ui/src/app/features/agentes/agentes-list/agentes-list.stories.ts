// ============================================================
// agentes-list.stories.ts
//
// Storybook 8 stories para AgentesListComponent.
// ============================================================
import type { Meta, StoryObj } from '@storybook/angular';
import { AgentesListComponent } from './agentes-list.component';

const meta: Meta<AgentesListComponent> = {
  title: 'Features/AgentesList',
  component: AgentesListComponent,
  tags: ['autodocs'],
  parameters: {
    a11y: {
      disable: false,
      options: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } },
    },
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<AgentesListComponent>;

export const ComAgentes: Story = { name: 'Com Agentes' };
export const Carregando: Story = { name: 'Carregando' };
export const ListaVazia: Story = { name: 'Lista Vazia' };
export const ComErro: Story = { name: 'Com Erro' };
