import { randomUUID } from 'crypto'

import type { NotificationConfigRepository }             from '../domain/notification-config.repository.port'
import type { NotificationConfig, NotificationConfigPatch } from '../domain/notification-config.types'
import type { AlertSeverity }                            from '../domain/alert.types'

type ConfigRow = {
  id:              string
  tenantId:        string
  emailEnabled:    boolean
  emailRecipients: string[]
  webhookEnabled:  boolean
  webhookUrl:      string | null
  webhookSecret:   string | null
  minSeverity:     string
  updatedAt:       Date
}

export interface NotificationConfigPrismaClient {
  notificationConfig: {
    findUnique(args: object): Promise<ConfigRow | null>
    upsert(args: object): Promise<ConfigRow>
  }
}

export class PrismaNotificationConfigRepository implements NotificationConfigRepository {
  constructor(private readonly prisma: NotificationConfigPrismaClient) {}

  async findByTenant(tenantId: string): Promise<NotificationConfig | null> {
    const row = await this.prisma.notificationConfig.findUnique({
      where: { tenantId },
    })
    return row ? this.map(row) : null
  }

  async upsert(tenantId: string, patch: NotificationConfigPatch): Promise<NotificationConfig> {
    const row = await this.prisma.notificationConfig.upsert({
      where:  { tenantId },
      update: {
        ...(patch.emailEnabled    !== undefined ? { emailEnabled:    patch.emailEnabled    } : {}),
        ...(patch.emailRecipients !== undefined ? { emailRecipients: patch.emailRecipients } : {}),
        ...(patch.webhookEnabled  !== undefined ? { webhookEnabled:  patch.webhookEnabled  } : {}),
        ...(patch.webhookUrl      !== undefined ? { webhookUrl:      patch.webhookUrl      } : {}),
        ...(patch.webhookSecret   !== undefined ? { webhookSecret:   patch.webhookSecret   } : {}),
        ...(patch.minSeverity     !== undefined ? { minSeverity:     patch.minSeverity     } : {}),
      },
      create: {
        id:              randomUUID(),
        tenantId,
        emailEnabled:    patch.emailEnabled    ?? false,
        emailRecipients: patch.emailRecipients ?? [],
        webhookEnabled:  patch.webhookEnabled  ?? false,
        webhookUrl:      patch.webhookUrl      ?? null,
        webhookSecret:   patch.webhookSecret   ?? null,
        minSeverity:     patch.minSeverity     ?? 'HIGH',
      },
    }) as ConfigRow

    return this.map(row)
  }

  private map(row: ConfigRow): NotificationConfig {
    return {
      id:              row.id,
      tenantId:        row.tenantId,
      emailEnabled:    row.emailEnabled,
      emailRecipients: row.emailRecipients,
      webhookEnabled:  row.webhookEnabled,
      webhookUrl:      row.webhookUrl,
      webhookSecret:   row.webhookSecret,
      minSeverity:     row.minSeverity as AlertSeverity,
      updatedAt:       row.updatedAt,
    }
  }
}
