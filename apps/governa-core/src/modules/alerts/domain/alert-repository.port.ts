// ============================================================
// alert-repository.port.ts — PORTA (hexagonal)
//
// Define o contrato que TODA implementação de persistência de
// alertas deve respeitar.
//
// Invariantes:
//   - filtra SEMPRE por tenantId (isolamento multi-tenant)
//   - listAlerts retorna os mais recentes primeiro (createdAt desc)
// ============================================================

import type { Alert, AlertKind, AlertStatus, AlertThreshold } from './alert.types'

// ─── Filtros ──────────────────────────────────────────────────────────────────

export interface AlertFilter {
  agentId?:  string
  kind?:     AlertKind
  status?:   AlertStatus
  from?:     Date
  to?:       Date
  page?:     number  // 1-based, default 1
  limit?:    number  // default 20, max 100
}

export interface AlertPage {
  data:  Alert[]
  total: number
  page:  number
  limit: number
}

// ─── Porta ────────────────────────────────────────────────────────────────────

export interface AlertRepository {
  /** Lista alertas paginados, do mais recente ao mais antigo. */
  list(tenantId: string, filter: AlertFilter): Promise<AlertPage>

  /** Retorna um alerta por ID (null se não encontrado ou de outro tenant). */
  findById(tenantId: string, id: string): Promise<Alert | null>

  /** Persiste um novo alerta. */
  create(alert: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Promise<Alert>

  /** Atualiza o status de um alerta (OPEN → ACKNOWLEDGED → RESOLVED). */
  updateStatus(tenantId: string, id: string, status: AlertStatus): Promise<Alert>

  /** Retorna todos os thresholds configurados para o tenant. */
  listThresholds(tenantId: string): Promise<AlertThreshold[]>

  /** Upsert de threshold por kind. */
  upsertThreshold(
    tenantId:  string,
    kind:      AlertKind,
    patch:     Partial<Omit<AlertThreshold, 'id' | 'tenantId' | 'kind' | 'updatedAt'>>,
  ): Promise<AlertThreshold>
}
