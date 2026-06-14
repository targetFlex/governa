// ============================================================
// alertas-list.stories.ts — Storybook para AlertasListComponent
// ============================================================

import type { Meta, StoryObj }  from '@storybook/angular';
import { AlertasListComponent } from './alertas-list.component';
import { AlertasStore }         from '../alertas.service';
import { Alert, AlertThreshold } from '../../../shared/models/alertas.model';

const meta: Meta<AlertasListComponent> = {
  title:     'Features/Alertas/AlertasListComponent',
  component: AlertasListComponent,
};

export default meta;
type Story = StoryObj<AlertasListComponent>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAlert(partial: Partial<Alert> = {}): Alert {
  return {
    id:        'alert-1',
    tenantId:  'tenant-1',
    agentId:   '00000000-0000-0000-0000-000000000001',
    kind:      'TOOL_BLOCKED',
    severity:  'HIGH',
    status:    'OPEN',
    message:   'Tool read_clientes bloqueada por política consultiva',
    metadata:  {},
    createdAt: '2026-06-13T10:00:00.000Z',
    updatedAt: '2026-06-13T10:00:00.000Z',
    ...partial,
  };
}

function makeThreshold(kind = 'TOOL_BLOCKED'): AlertThreshold {
  return {
    id: 'thresh-1', tenantId: 'tenant-1',
    kind:                kind as AlertThreshold['kind'],
    enabled:             true,
    errorRatePercent:    null,
    volumePerHour:       null,
    checkpointExpiryMin: null,
    updatedAt:           '2026-06-13T10:00:00.000Z',
  };
}

function storeMock(overrides: Record<string, unknown> = {}) {
  return {
    provide:  AlertasStore,
    useValue: {
      alertas:         () => [],
      total:           () => 0,
      page:            () => 1,
      limit:           () => 20,
      totalPages:      () => 1,
      loading:         () => false,
      loadingStatus:   () => false,
      loadingThresh:   () => false,
      error:           () => null,
      hasError:        () => false,
      isEmpty:         () => true,
      openCount:       () => 0,
      streamConnected: () => false,
      thresholds:      () => [],
      filtros:         () => ({ agentId: '', kind: '', status: '', from: '', to: '', page: 1, limit: 20 }),
      loadAlertas:       () => {},
      atualizarStatus:   () => {},
      loadThresholds:    () => {},
      salvarThreshold:   () => {},
      limparFiltros:     () => {},
      clearError:        () => {},
      conectarStream:    () => {},
      desconectarStream: () => {},
      ...overrides,
    },
  };
}

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Feed vazio — nenhum alerta, SSE desconectado. */
export const Vazio: Story = {
  providers: [storeMock()],
};

/** Feed carregando — skeletons visíveis. */
export const Carregando: Story = {
  providers: [storeMock({ loading: () => true, isEmpty: () => false })],
};

/** Feed com alertas — mix de severidades e status. */
export const ComAlertas: Story = {
  providers: [storeMock({
    alertas: () => [
      makeAlert({ id: 'a1', kind: 'TOOL_BLOCKED',       severity: 'HIGH',     status: 'OPEN' }),
      makeAlert({ id: 'a2', kind: 'ERROR_RATE',          severity: 'MEDIUM',   status: 'ACKNOWLEDGED' }),
      makeAlert({ id: 'a3', kind: 'CHECKPOINT_EXPIRED',  severity: 'CRITICAL', status: 'OPEN',
        message: 'Checkpoint de aprovação expirou após 60 min sem resposta do gestor.' }),
      makeAlert({ id: 'a4', kind: 'VOLUME_ANOMALY',      severity: 'LOW',      status: 'RESOLVED' }),
    ],
    total:   () => 4,
    isEmpty: () => false,
    openCount: () => 2,
    streamConnected: () => true,
  })],
};

/** Feed com erro — banner de erro visível. */
export const ComErro: Story = {
  providers: [storeMock({
    hasError: () => true,
    error:    () => 'Falha ao conectar ao servidor de alertas. Verifique sua conexão.',
    isEmpty:  () => false,
  })],
};

/** SSE ao vivo — indicador de conexão ativo. */
export const StreamAtivo: Story = {
  providers: [storeMock({
    alertas: () => [makeAlert({ status: 'OPEN' })],
    isEmpty: () => false,
    total:   () => 1,
    openCount: () => 1,
    streamConnected: () => true,
  })],
};

/** Painel de configuração aberto com thresholds. */
export const ConfiguracaoAberta: Story = {
  render: (args, { providers }) => ({
    props: {
      ...args,
      ngOnInit() {
        (this as AlertasListComponent & { mostrarConfig: boolean }).mostrarConfig = true;
      },
    },
    providers,
  }),
  providers: [storeMock({
    thresholds: () => [
      makeThreshold('TOOL_BLOCKED'),
      makeThreshold('ERROR_RATE'),
      makeThreshold('CHECKPOINT_EXPIRED'),
      makeThreshold('VOLUME_ANOMALY'),
    ],
    loadingThresh: () => false,
    isEmpty:       () => false,
  })],
};
