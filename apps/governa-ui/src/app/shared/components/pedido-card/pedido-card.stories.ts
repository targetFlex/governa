// ============================================================
// pedido-card.stories.ts
//
// Storybook 8 stories para PedidoCardComponent.
// O addon @storybook/addon-a11y executa axe-core em todas as
// stories automaticamente — violations exibidas no painel A11y.
//
// HttpClientModule é necessário porque o card injeta
// ClientePiiService (HttpClient) para a revelação sob demanda do
// cliente — sem backend real no Storybook, o botão de revelação
// fica em loading indefinido nas stories (comportamento esperado).
// ============================================================
import type { Meta, StoryObj } from '@storybook/angular';
import { HttpClientModule } from '@angular/common/http';
import { moduleMetadata } from '@storybook/angular';
import { PedidoCardComponent } from './pedido-card.component';
import type { Pedido } from '../../models/pedido.model';

// ── Fixture base ──────────────────────────────────────────────

const pedidoBase: Pedido = {
  numeroPedido: 'PED-0001',
  clienteId: 'CLI001',
  loja: '01',
  status: 'ABERTO',
  valorTotal: 15750.50,
  dataEmissao: '2026-01-15T00:00:00Z',
  itens: [
    { codigoProduto: 'PROD01', quantidade: 3, precoUnitario: 3500 },
    { codigoProduto: 'PROD02', quantidade: 1, precoUnitario: 5250.50 },
  ],
};

// ── Meta ──────────────────────────────────────────────────────

const meta: Meta<PedidoCardComponent> = {
  title: 'Shared/PedidoCard',
  component: PedidoCardComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [HttpClientModule] })],
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

/** Pedido aberto com dois itens */
export const Aberto: Story = {
  name: 'Aberto',
  args: { pedido: pedidoBase },
};

/** Pedido liberado para faturamento */
export const Liberado: Story = {
  name: 'Liberado',
  args: {
    pedido: {
      ...pedidoBase,
      numeroPedido: 'PED-0002',
      status: 'LIBERADO',
    },
  },
};

/** Pedido bloqueado — status que causava crash antes do fix (STATUS_META incompleto) */
export const Bloqueado: Story = {
  name: 'Bloqueado',
  args: {
    pedido: {
      ...pedidoBase,
      numeroPedido: 'PED-0003',
      status: 'BLOQUEADO',
      valorTotal: 87300,
    },
  },
};

/** Pedido encerrado / faturado */
export const Encerrado: Story = {
  name: 'Encerrado',
  args: {
    pedido: {
      ...pedidoBase,
      numeroPedido: 'PED-0004',
      status: 'ENCERRADO',
      valorTotal: 4500,
      itens: [],
    },
  },
};
