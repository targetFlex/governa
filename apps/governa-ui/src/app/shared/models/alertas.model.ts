// ============================================================
// alertas.model.ts
//
// Tipos do domínio de alertas — espelha alert.types.ts do backend.
// Usado pelo AlertasStore e AlertasListComponent.
// ============================================================

export const ALERT_KINDS = [
  'TOOL_BLOCKED',
  'ERROR_RATE',
  'CHECKPOINT_EXPIRED',
  'VOLUME_ANOMALY',
] as const

export type AlertKind = typeof ALERT_KINDS[number]

export const ALERT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export type AlertSeverity = typeof ALERT_SEVERITIES[number]

export const ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const
export type AlertStatus = typeof ALERT_STATUSES[number]

// ─── Entidade ────────────────────────────────────────────────────────────────

export interface Alert {
  id:        string
  tenantId:  string
  agentId:   string
  kind:      AlertKind
  severity:  AlertSeverity
  status:    AlertStatus
  message:   string
  metadata:  Record<string, unknown>
  createdAt: string  // ISO string vindo do JSON
  updatedAt: string
}

// ─── Threshold ───────────────────────────────────────────────────────────────

export interface AlertThreshold {
  id:                   string
  tenantId:             string
  kind:                 AlertKind
  enabled:              boolean
  errorRatePercent:     number | null
  volumePerHour:        number | null
  checkpointExpiryMin:  number | null
  updatedAt:            string
}

export interface AlertPage {
  data:  Alert[]
  total: number
  page:  number
  limit: number
}

// ─── Filtros de UI ───────────────────────────────────────────────────────────

export interface AlertasFiltros {
  agentId: string
  kind:    AlertKind | ''
  status:  AlertStatus | ''
  from:    string
  to:      string
  page:    number
  limit:   number
}

// ─── Labels e CSS ────────────────────────────────────────────────────────────

export const KIND_LABELS: Record<AlertKind, string> = {
  TOOL_BLOCKED:       'Tool bloqueada',
  ERROR_RATE:         'Taxa de erro elevada',
  CHECKPOINT_EXPIRED: 'Checkpoint expirado',
  VOLUME_ANOMALY:     'Volume anômalo',
}

export const SEVERITY_CSS: Record<AlertSeverity, string> = {
  LOW:      'badge--low',
  MEDIUM:   'badge--medium',
  HIGH:     'badge--high',
  CRITICAL: 'badge--critical',
}

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  LOW:      'Baixa',
  MEDIUM:   'Média',
  HIGH:     'Alta',
  CRITICAL: 'Crítica',
}

export const STATUS_LABELS: Record<AlertStatus, string> = {
  OPEN:         'Aberto',
  ACKNOWLEDGED: 'Em análise',
  RESOLVED:     'Resolvido',
}

export const STATUS_CSS: Record<AlertStatus, string> = {
  OPEN:         'status--open',
  ACKNOWLEDGED: 'status--acknowledged',
  RESOLVED:     'status--resolved',
}
