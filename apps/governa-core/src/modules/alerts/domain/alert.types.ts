// ============================================================
// alert.types.ts
//
// Tipos de domínio para o módulo de alertas.
//
// AlertKind   — categoria do alerta (causa)
// AlertSeverity — grau de urgência
// Alert       — entidade imutável de um alerta disparado
// AlertThreshold — configuração de threshold por kind
// ============================================================

// ─── Enums ───────────────────────────────────────────────────────────────────

export const ALERT_KINDS = [
  'TOOL_BLOCKED',         // tool bloqueada por política de autonomia
  'ERROR_RATE',           // taxa de erro do agente acima do threshold
  'CHECKPOINT_EXPIRED',   // checkpoint humano expirou sem aprovação
  'VOLUME_ANOMALY',       // volume de decisões muito acima do normal
] as const

export type AlertKind = typeof ALERT_KINDS[number]

export const ALERT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export type AlertSeverity = typeof ALERT_SEVERITIES[number]

export const ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const
export type AlertStatus = typeof ALERT_STATUSES[number]

// ─── Labels legíveis ─────────────────────────────────────────────────────────

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  TOOL_BLOCKED:       'Tool bloqueada',
  ERROR_RATE:         'Taxa de erro elevada',
  CHECKPOINT_EXPIRED: 'Checkpoint expirado',
  VOLUME_ANOMALY:     'Volume anômalo',
}

export const ALERT_SEVERITY_CSS: Record<AlertSeverity, string> = {
  LOW:      'badge--low',
  MEDIUM:   'badge--medium',
  HIGH:     'badge--high',
  CRITICAL: 'badge--critical',
}

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  OPEN:         'Aberto',
  ACKNOWLEDGED: 'Em análise',
  RESOLVED:     'Resolvido',
}

// ─── Entidade Alert ──────────────────────────────────────────────────────────

export interface Alert {
  id:        string        // UUID
  tenantId:  string        // isolamento multi-tenant
  agentId:   string        // UUID do agente que disparou o alerta
  kind:      AlertKind
  severity:  AlertSeverity
  status:    AlertStatus
  message:   string        // mensagem descritiva para o operador
  metadata:  Record<string, unknown>  // dados extras (ex: toolName, errorRate)
  createdAt: Date
  updatedAt: Date
}

// ─── Threshold de configuração ───────────────────────────────────────────────

export interface AlertThreshold {
  id:                   string
  tenantId:             string
  kind:                 AlertKind
  enabled:              boolean
  errorRatePercent:     number | null  // para ERROR_RATE (ex: 10 = 10%)
  volumePerHour:        number | null  // para VOLUME_ANOMALY (ex: 500 decisões/h)
  checkpointExpiryMin:  number | null  // para CHECKPOINT_EXPIRED (ex: 60 min)
  updatedAt:            Date
}

// ─── Defaults de threshold por kind ─────────────────────────────────────────

export const DEFAULT_THRESHOLDS: Omit<AlertThreshold, 'id' | 'tenantId' | 'updatedAt'>[] = [
  {
    kind:                 'TOOL_BLOCKED',
    enabled:              true,
    errorRatePercent:     null,
    volumePerHour:        null,
    checkpointExpiryMin:  null,
  },
  {
    kind:                 'ERROR_RATE',
    enabled:              true,
    errorRatePercent:     10,
    volumePerHour:        null,
    checkpointExpiryMin:  null,
  },
  {
    kind:                 'CHECKPOINT_EXPIRED',
    enabled:              true,
    errorRatePercent:     null,
    volumePerHour:        null,
    checkpointExpiryMin:  60,
  },
  {
    kind:                 'VOLUME_ANOMALY',
    enabled:              false,
    errorRatePercent:     null,
    volumePerHour:        500,
    checkpointExpiryMin:  null,
  },
]
