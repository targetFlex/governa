// ============================================================
// notification-config.model.ts
//
// Tipos do domínio de configuração de notificações — espelha
// notification-config.types.ts do backend (sem webhookSecret).
// ============================================================

import type { AlertSeverity } from './alertas.model'

export { ALERT_SEVERITIES } from './alertas.model'
export type { AlertSeverity } from './alertas.model'

export interface NotificationConfig {
  id:              string
  tenantId:        string
  emailEnabled:    boolean
  emailRecipients: string[]
  webhookEnabled:  boolean
  webhookUrl:      string | null
  minSeverity:     AlertSeverity
  updatedAt:       string
}

export interface NotificationConfigPatch {
  emailEnabled?:    boolean
  emailRecipients?: string[]
  webhookEnabled?:  boolean
  webhookUrl?:      string | null
  webhookSecret?:   string | null
  minSeverity?:     AlertSeverity
}

export const SEVERITY_OPTION_LABELS: Record<AlertSeverity, string> = {
  LOW:      'Baixa ou superior',
  MEDIUM:   'Média ou superior',
  HIGH:     'Alta ou superior',
  CRITICAL: 'Somente crítica',
}
