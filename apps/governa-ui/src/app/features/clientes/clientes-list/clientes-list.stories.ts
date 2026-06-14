// ============================================================
// clientes-list.stories.ts
//
// Stories do ClientesListComponent para Storybook 8.
// Cada story simula um estado distinto do ClientesStore.
// ============================================================
import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { signal, computed } from '@angular/core';

import { ClientesListComponent } from './clientes-list.component';
import { ClientesStore } from '../clientes.service';
import { Cliente } from '../../../shared/models/cliente.model';

// ── Helpers ──────────────────────────────────────────────────

function makeCliente(override: Partial<Cliente> = {}): Cliente {
  return {
    id: Math.random().toString(36).slice(2),
    codigo: 'CLI' + Math.floor(Math.random() * 900 + 100),
    nome: 'Empresa Exemplo Ltda',
    tipoPessoa: 'PJ',
    documento: '12.345.678/0001-99',
    email: 'contato@exemplo.com',
    telefone: '(11) 99999-9999',
    ativo: true,
    limiteCredito: 50000,
    saldoDevedor: 1250,
    moeda: 'BRL',
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-06-01T00:00:00Z',
    ...override,
  };
}

const CLIENTES_FIXTURE: Cliente[] = [
  makeCliente({ id: '1', nome: 'Acme Tecnologia Ltda', tipoPessoa: 'PJ', codigo: 'CLI001', ativo: true }),
  makeCliente({ id: '2', nome: 'João da Silva', tipoPessoa: 'PF', documento: '123.456.789-00', codigo: 'CLI002', ativo: true, saldoDevedor: 0 }),
  makeCliente({ id: '3', nome: 'Beta Comércio S/A', tipoPessoa: 'PJ', codigo: 'CLI003', ativo: false, limiteCredito: 200000 }),
  makeCliente({ id: '4', nome: 'Gama Serviços ME', tipoPessoa: 'PJ', codigo: 'CLI004', ativo: true, telefone: null }),
  makeCliente({ id: '5', nome: 'Maria Aparecida', tipoPessoa: 'PF', documento: '987.654.321-00', codigo: 'CLI005', ativo: true, saldoDevedor: 3500 }),
  makeCliente({ id: '6', nome: 'Delta Indústria Ltda', tipoPessoa: 'PJ', codigo: 'CLI006', ativo: true, limiteCredito: 1000000, saldoDevedor: 250000 }),
];

function mockStore(opts: {
  clientes?: Cliente[];
  loading?: boolean;
  error?: string | null;
  total?: number;
}) {
  const clientes = signal<Cliente[]>(opts.clientes ?? []);
  const loading  = signal<boolean>(opts.loading ?? false);
  const error    = signal<string | null>(opts.error ?? null);
  const total    = signal<number>(opts.total ?? 0);

  return {
    clientes,
    loading,
    error,
    total,
    isEmpty:  computed(() => !loading() && clientes().length === 0),
    hasError: computed(() => error() !== null),
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
      providers: [
        {
          provide: ClientesStore,
          useValue: mockStore({ clientes: CLIENTES_FIXTURE, total: 6 }),
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
          provide: ClientesStore,
          useValue: mockStore({ loading: true }),
        },
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
        {
          provide: ClientesStore,
          useValue: mockStore({ clientes: [], total: 0 }),
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
          provide: ClientesStore,
          useValue: mockStore({ error: 'Não foi possível conectar ao servidor. Verifique sua conexão.' }),
        },
      ],
    }),
  ],
};
