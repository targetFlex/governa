// ============================================================
// pedidos-list.stories.ts
//
// Stories do PedidosListComponent para Storybook 8.
// Cada story simula um estado distinto do PedidosStore.
// ============================================================
import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { HttpClientModule } from '@angular/common/http';
import { signal, computed, importProvidersFrom } from '@angular/core';

import { PedidosListComponent } from './pedidos-list.component';
import { PedidosStore } from '../pedidos.service';
import { Pedido } from '../../../shared/models/pedido.model';

// ── Helpers ──────────────────────────────────────────────────

function makePedido(override: Partial<Pedido> = {}): Pedido {
  return {
    numeroPedido: 'PED-' + Math.floor(Math.random() * 9000 + 1000),
    clienteId: 'CLI001',
    loja: '01',
    status: 'ABERTO',
    valorTotal: 12500,
    dataEmissao: '2026-01-15T00:00:00Z',
    itens: [{ codigoProduto: 'P01', quantidade: 1, precoUnitario: 12500 }],
    ...override,
  };
}

const PEDIDOS_FIXTURE: Pedido[] = [
  makePedido({ numeroPedido: 'PED-0001', clienteId: 'CLI001', status: 'ABERTO',    valorTotal: 15750 }),
  makePedido({ numeroPedido: 'PED-0002', clienteId: 'CLI002', status: 'LIBERADO',  valorTotal: 8200 }),
  makePedido({ numeroPedido: 'PED-0003', clienteId: 'CLI003', status: 'BLOQUEADO', valorTotal: 87300 }),
  makePedido({ numeroPedido: 'PED-0004', clienteId: 'CLI004', status: 'ENCERRADO', valorTotal: 4500, itens: [] }),
  makePedido({ numeroPedido: 'PED-0005', clienteId: 'CLI005', status: 'ENCERRADO', valorTotal: 22000 }),
  makePedido({ numeroPedido: 'PED-0006', clienteId: 'CLI006', status: 'ABERTO',    valorTotal: 6750 }),
];

function mockStore(opts: {
  pedidos?: Pedido[];
  loading?: boolean;
  error?: string | null;
  total?: number;
  page?: number;
  pageSize?: number;
}) {
  const pedidos  = signal<Pedido[]>(opts.pedidos ?? []);
  const loading  = signal<boolean>(opts.loading ?? false);
  const error    = signal<string | null>(opts.error ?? null);
  const total    = signal<number>(opts.total ?? 0);
  const page     = signal<number>(opts.page ?? 1);
  const pageSize = signal<number>(opts.pageSize ?? 20);
  const filtro   = signal<string>('');

  return {
    pedidos,
    loading,
    error,
    total,
    page,
    pageSize,
    filtro,
    isEmpty:    computed(() => !loading() && pedidos().length === 0),
    hasError:   computed(() => error() !== null),
    totalPages: computed(() => Math.ceil(total() / pageSize())),
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
      // HttpClientModule é necessário porque app-pedido-card injeta
      // ClientePiiService — sem backend real, revelação de cliente fica em loading.
      providers: [
        { provide: PedidosStore, useValue: mockStore({ pedidos: PEDIDOS_FIXTURE, total: 6 }) },
        importProvidersFrom(HttpClientModule),
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
        { provide: PedidosStore, useValue: mockStore({ loading: true }) },
        importProvidersFrom(HttpClientModule),
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
        { provide: PedidosStore, useValue: mockStore({ pedidos: [], total: 0 }) },
        importProvidersFrom(HttpClientModule),
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
        importProvidersFrom(HttpClientModule),
      ],
    }),
  ],
};
