import type { NotificationConfig, NotificationConfigPatch } from './notification-config.types'

export interface NotificationConfigRepository {
  findByTenant(tenantId: string): Promise<NotificationConfig | null>
  upsert(tenantId: string, patch: NotificationConfigPatch): Promise<NotificationConfig>
}
