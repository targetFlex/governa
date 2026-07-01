import type { AlertSeverity } from './alert.types'

export interface NotificationConfig {
  id:              string
  tenantId:        string
  emailEnabled:    boolean
  emailRecipients: string[]
  webhookEnabled:  boolean
  webhookUrl:      string | null
  webhookSecret:   string | null
  minSeverity:     AlertSeverity
  updatedAt:       Date
}

export interface NotificationConfigPatch {
  emailEnabled?:    boolean
  emailRecipients?: string[]
  webhookEnabled?:  boolean
  webhookUrl?:      string | null
  webhookSecret?:   string | null
  minSeverity?:     AlertSeverity
}
