/**
 * auditoria-list.stories.ts — Storybook stories para AuditoriaListComponent.
 * 6 stories cobrindo os estados principais.
 */

import { applicationConfig, type Meta, type StoryObj } from '@storybook/angular';
import { importProvidersFrom }                           from '@angular/core';
import { HttpClientModule }                              from '@angular/common/http';
import { AuditoriaListComponent }                        from './auditoria-list.component';
import { AuditoriaStore }                                from '../auditoria.service';
import { AuditEvent }                                    from '../../../shared/models/auditoria.model';

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeEvent(partial: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id:             'evt-1',
    tenantId:       'tenant-1',
    agentId:        '00000000-0000-0000-0000-000000000001',
    traceId:        'trace-1',
    action:         'read_protheus_pedido',
    inputSummary:   'consulta pedido #42 — cliente ACME Ltda',
    outcome:        'EXECUTADO',
    latencyMs:      112,
    subjectToken:   'sub-abc',
    dataCategories: ['pedido'],
    legalBasis:     'Legítimo interesse',
    purpose:        'Atendimento ao cliente',
    retentionUntil: '2031-06-01T00:00:00.000Z',
    createdAt:      '2026-06-01T10:30:00.000Z',
    ...partial,
  };
}

function makeStore(overrides: Record<string, unknown> = {}) {
  return {
    provide: AuditoriaStore,
    useValue: {
      eventos:       () => [],
      total:         () => 0,
      page:          () => 1,
      limit:         () => 20,
      totalPages:    () => 1,
      loading:       () => false,
      loadingExport: () => false,
      error:         () => null,
      hasError:      () => false,
      isEmpty:       () => true,
      filtros:       () => ({ agentId: '', from: '', to: '', outcome: '', page: 1, limit: 20 }),
      loadEventos:   () => undefined,
      exportarPDF:   () => undefined,
      limparFiltros: () => undefined,
      clearError:    () => undefined,
      ...overrides,
    },
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<AuditoriaListComponent> = {
  title:     'Features/Auditoria/AuditoriaList',
  component: AuditoriaListComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(HttpClientModule)],
    }),
  ],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<AuditoriaListComponent>;

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Story 1 — Loading state */
export const Loading: Story = {
  decorators: [
    applicationConfig({
      providers: [makeStore({ loading: () => true, isEmpty: () => false })],
    }),
  ],
};

/** Story 2 — Empty state */
export const Empty: Story = {
  decorators: [
    applicationConfig({
      providers: [makeStore({ isEmpty: () => true })],
    }),
  ],
};

/** Story 3 — Lista com eventos (página 1 de 3) */
export const ComEventos: Story = {
  decorators: [
    applicationConfig({
      providers: [
        makeStore({
          eventos: () => [
            makeEvent({ outcome: 'EXECUTADO' }),
            makeEvent({ id: 'evt-2', outcome: 'BLOQUEADO',  action: 'write_protheus_pedido',   inputSummary: 'tentativa de escrita bloqueada pela policy' }),
            makeEvent({ id: 'evt-3', outcome: 'AGUARDANDO', action: 'cancel_protheus_pedido',  inputSummary: 'cancelamento aguardando aprovação humana' }),
            makeEvent({ id: 'evt-4', outcome: 'ESCALADO',   action: 'read_protheus_cliente',   inputSummary: 'escalado — critério de devolução fora do escopo' }),
            makeEvent({ id: 'evt-5', outcome: 'ERRO',       action: 'read_protheus_nf',        inputSummary: 'timeout ao consultar NF-e' }),
          ],
          isEmpty:    () => false,
          total:      () => 45,
          page:       () => 1,
          totalPages: () => 3,
        }),
      ],
    }),
  ],
};

/** Story 4 — Erro de conexão */
export const ComErro: Story = {
  decorators: [
    applicationConfig({
      providers: [
        makeStore({
          hasError: () => true,
          error:    () => 'Erro ao carregar eventos: conexão recusada em governa-core:3000',
          isEmpty:  () => false,
        }),
      ],
    }),
  ],
};

/** Story 5 — Exportando PDF (loading export) */
export const ExportandoPDF: Story = {
  decorators: [
    applicationConfig({
      providers: [
        makeStore({
          eventos:       () => [makeEvent()],
          isEmpty:       () => false,
          loadingExport: () => true,
          total:         () => 1,
        }),
      ],
    }),
  ],
};

/** Story 6 — Página 2 de 3 (paginação ativa) */
export const PaginaIntermediaria: Story = {
  decorators: [
    applicationConfig({
      providers: [
        makeStore({
          eventos:    () => [makeEvent({ id: 'evt-21' }), makeEvent({ id: 'evt-22' })],
          isEmpty:    () => false,
          page:       () => 2,
          totalPages: () => 3,
          total:      () => 60,
        }),
      ],
    }),
  ],
};
