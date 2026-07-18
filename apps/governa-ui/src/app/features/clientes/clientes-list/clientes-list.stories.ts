// ============================================================
// clientes-list.stories.ts
//
// Stories do ClientesListComponent para Storybook 8.
// Cada story simula um estado distinto do ClientesStore.
// ============================================================
import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { HttpClientModule } from '@angular/common/http';
import { signal, computed, importProvidersFrom } from '@angular/core';

import { ClientesListComponent } from './clientes-list.component';
import { ClientesStore } from '../clientes.service';
import { Cliente } from '../../../shared/models/cliente.model';

// ── Helpers ──────────────────────────────────────────────────

function makeCliente(override: Partial<Cliente> = {}): Cliente {
  return {
    clienteId: 'CLI' + Math.floor(Math.random() * 900 + 100),
    loja: '01',
    nomeToken: 'a'.repeat(64),
    documentoToken: 'b'.repeat(64),
    enderecoToken: 'c'.repeat(64),
    emailToken: 'd'.repeat(64),
    telefoneToken: 'e'.repeat(64),
    bloqueado: false,
    ...override,
  };
}

const CLIENTES_FIXTURE: Cliente[] = [
  makeCliente({ clienteId: 'CLI001' }),
  makeCliente({ clienteId: 'CLI002', telefoneToken: null }),
  makeCliente({ clienteId: 'CLI003', bloqueado: true }),
  makeCliente({ clienteId: 'CLI004', loja: '02' }),
  makeCliente({ clienteId: 'CLI005', emailToken: null }),
  makeCliente({ clienteId: 'CLI006', loja: '02', bloqueado: true }),
];

function mockStore(opts: {
  clientes?: Cliente[];
  loading?: boolean;
  error?: string | null;
  total?: number;
  page?: number;
  pageSize?: number;
}) {
  const clientes = signal<Cliente[]>(opts.clientes ?? []);
  const loading  = signal<boolean>(opts.loading ?? false);
  const error    = signal<string | null>(opts.error ?? null);
  const total    = signal<number>(opts.total ?? 0);
  const page     = signal<number>(opts.page ?? 1);
  const pageSize = signal<number>(opts.pageSize ?? 20);
  const filtro   = signal<string>('');

  return {
    clientes,
    loading,
    error,
    total,
    page,
    pageSize,
    filtro,
    isEmpty:    computed(() => !loading() && clientes().length === 0),
    hasError:   computed(() => error() !== null),
    totalPages: computed(() => Math.ceil(total() / pageSize())),
    loadClientes: () => {},
    clearError:   () => {},
  };
}

// ── Meta ──────────────────────────────────────────────────────

const meta: Meta<ClientesListComponent> = {
  title: 'Features/Clientes/ClientesListComponent',
  component: ClientesListComponent,
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
type Story = StoryObj<ClientesListComponent>;

// ── Stories ───────────────────────────────────────────────────

/** Lista populada com 6 clientes variados */
export const ComClientes: Story = {
  name: 'Com Clientes',
  decorators: [
    applicationConfig({
      // HttpClientModule é necessário porque app-cliente-card injeta
      // ClientePiiService — sem backend real, "Revelar dados" fica em loading.
      providers: [
        { provide: ClientesStore, useValue: mockStore({ clientes: CLIENTES_FIXTURE, total: 6 }) },
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
        { provide: ClientesStore, useValue: mockStore({ loading: true }) },
        importProvidersFrom(HttpClientModule),
      ],
    }),
  ],
};

/** Nenhum cliente retornado pela API */
export const ListaVazia: Story = {
  name: 'Lista Vazia',
  decorators: [
    applicationConfig({
      providers: [
        { provide: ClientesStore, useValue: mockStore({ clientes: [], total: 0 }) },
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
          provide: ClientesStore,
          useValue: mockStore({ error: 'Não foi possível conectar ao servidor. Verifique sua conexão.' }),
        },
        importProvidersFrom(HttpClientModule),
      ],
    }),
  ],
};
