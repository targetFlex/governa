// ============================================================
// pedidos-list.stories.ts
//
// Stories do PedidosListComponent para Storybook 8.
// Cada story simula um estado distinto do PedidosStore.
// ============================================================
import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { signal, computed } from '@angular/core';

import { PedidosListComponent } from './pedidos-list.component';
import { PedidosStore } from '../pedidos.service';
import { Pedido } from '../../../shared/models/pedido.model';

// ── Helpers ──────────────────────────────────────────────────

function makePedido(override: Partial<Pedido> = {}): Pedido {
  return {
    id: Math.random().toString(36).slice(2),
    numero: 'PED-' + Math.floor(Math.random() * 9000 + 1000),
    clienteId: 'c1',
    clienteNome: 'Empresa Exemplo Ltda',
    status: 'ABERTO',
    valor: 12500,
    moeda: 'BRL',
    dataEmissao: '2026-01-15T00:00:00Z',
    dataEntregaPrevista: '2026-02-01T00:00:00Z',
    itens: [
      { codigo: 'P01', descricao: 'Produto', quantidade: 1, valorUnitario: 12500, valorTotal: 12500 },
    ],
    ...override,
  };
}

const PEDIDOS_FIXTURE: Pedido[] = [
  makePedido({ id: '1', numero: 'PED-0001', clienteNome: 'Acme Tecnologia Ltda', status: 'ABERTO',       valor: 15750 }),
  makePedido({ id: '2', numero: 'PED-0002', clienteNome: 'Beta Sistemas ME',     status: 'EM_APROVACAO', valor: 8200, dataEntregaPrevista: null }),
  makePedido({ id: '3', numero: 'PED-0003', clienteNome: 'Gama Indústria SA',    status: 'APROVADO',     valor: 87300 }),
  makePedido({ id: '4', numero: 'PED-0004', clienteNome: 'Delta Comércio Ltda',  status: 'CANCELADO',    valor: 4500, dataEntregaPrevista: null, itens: [] }),
  makePedido({ id: '5', numero: 'PED-0005', clienteNome: 'Omega Serviços EIRELI',status: 'ENCERRADO',    valor: 22000 }),
  makePedido({ id: '6', numero: 'PED-0006', clienteNome: 'Zeta Distribuidora SA',status: 'ABERTO',       valor: 6750 }),
];

function mockStore(opts: {
  pedidos?: Pedido[];
  loading?: boolean;
  error?: string | null;
  total?: number;
}) {
  const pedidos = signal<Pedido[]>(opts.pedidos ?? []);
  const loading = signal<boolean>(opts.loading ?? false);
  const error   = signal<string | null>(opts.error ?? null);
  const total   = signal<number>(opts.total ?? 0);

  return {
    pedidos,
    loading,
    error,
    total,
    isEmpty:  computed(() => !loading() && pedidos().length === 0),
    hasError: computed(() => error() !== null),
    loadPedidos: () => {},
    clearError:  () => {},
  };
}

// ── Meta ──────────────────────────────────────────────────────

const meta: Meta<PedidosListComponent> = {
  title: 'Features/Pedidos/PedidosListComponent',
  component: PedidosListComponent,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      disable: false,
      config: {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      },
    },
  },
};

export default meta;
type Story = StoryObj<PedidosListComponent>;

// ── Stories ───────────────────────────────────────────────────

/** Lista com 6 pedidos em diferentes status */
export const ComPedidos: Story = {
  name: 'Com Pedidos',
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: PedidosStore,
          useValue: mockStore({ pedidos: PEDIDOS_FIXTURE, total: 6 }),
        },
      ],
    }),
  ],
};

/** Skeletons animados durante carregamento */
export const Carregando: Story = {
  name: 'Carregando',
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: PedidosStore,
          useValue: mockStore({ loading: true }),
        },
      ],
    }),
  ],
};

/** Nenhum pedido retornado pela API */
export const ListaVazia: Story = {
  name: 'Lista Vazia',
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: PedidosStore,
          useValue: mockStore({ pedidos: [], total: 0 }),
        },
      ],
    }),
  ],
};

/** Erro de comunicação com o gateway */
export const ComErro: Story = {
  name: 'Com Erro',
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: PedidosStore,
          useValue: mockStore({ error: 'Não foi possível conectar ao servidor. Verifique sua conexão.' }),
        },
      ],
    }),
  ],
};
