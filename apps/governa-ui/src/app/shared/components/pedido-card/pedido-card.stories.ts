// ============================================================
// pedido-card.stories.ts
//
// Storybook 8 stories para PedidoCardComponent.
// O addon @storybook/addon-a11y executa axe-core em todas as
// stories automaticamente — violations exibidas no painel A11y.
// ============================================================
import type { Meta, StoryObj } from '@storybook/angular';
import { PedidoCardComponent } from './pedido-card.component';
import type { Pedido } from '../../models/pedido.model';

// ── Fixture base ──────────────────────────────────────────────

const pedidoBase: Pedido = {
  id: 'p1',
  numero: 'PED-0001',
  clienteId: 'c1',
  clienteNome: 'Acme Tecnologia Ltda',
  status: 'ABERTO',
  valor: 15750.50,
  moeda: 'BRL',
  dataEmissao: '2026-01-15T00:00:00Z',
  dataEntregaPrevista: '2026-02-01T00:00:00Z',
  itens: [
    { codigo: 'PROD01', descricao: 'Licença de Software', quantidade: 3, valorUnitario: 3500, valorTotal: 10500 },
    { codigo: 'PROD02', descricao: 'Suporte Anual',       quantidade: 1, valorUnitario: 5250.50, valorTotal: 5250.50 },
  ],
};

// ── Meta ──────────────────────────────────────────────────────

const meta: Meta<PedidoCardComponent> = {
  title: 'Shared/PedidoCard',
  component: PedidoCardComponent,
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
    pedido: { control: 'object' },
  },
};

export default meta;
type Story = StoryObj<PedidoCardComponent>;

// ── Stories ───────────────────────────────────────────────────

/** Pedido aberto com dois itens e data de entrega */
export const Aberto: Story = {
  name: 'Aberto',
  args: { pedido: pedidoBase },
};

/** Pedido em processo de aprovação */
export const EmAprovacao: Story = {
  name: 'Em Aprovação',
  args: {
    pedido: {
      ...pedidoBase,
      id: 'p2',
      numero: 'PED-0002',
      clienteNome: 'Beta Sistemas ME',
      status: 'EM_APROVACAO',
      dataEntregaPrevista: null,
    },
  },
};

/** Pedido aprovado aguardando faturamento */
export const Aprovado: Story = {
  name: 'Aprovado',
  args: {
    pedido: {
      ...pedidoBase,
      id: 'p3',
      numero: 'PED-0003',
      clienteNome: 'Gama Indústria SA',
      status: 'APROVADO',
      valor: 87300,
    },
  },
};

/** Pedido cancelado — exibe opacidade reduzida e badge vermelho */
export const Cancelado: Story = {
  name: 'Cancelado',
  args: {
    pedido: {
      ...pedidoBase,
      id: 'p4',
      numero: 'PED-0004',
      clienteNome: 'Delta Comércio Ltda',
      status: 'CANCELADO',
      dataEntregaPrevista: null,
      itens: [],
    },
  },
};

/** Pedido encerrado / faturado */
export const Encerrado: Story = {
  name: 'Encerrado',
  args: {
    pedido: {
      ...pedidoBase,
      id: 'p5',
      numero: 'PED-0005',
      clienteNome: 'Omega Serviços EIRELI',
      status: 'ENCERRADO',
      valor: 4500,
    },
  },
};
