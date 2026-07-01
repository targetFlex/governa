import { Router, type Request, type Response } from 'express'
import { z, ZodError }                          from 'zod'
import type { NotificationService }             from '../application/notification.service'
import type { AuthenticatedRequest }            from '../../../shared/middleware/tenant.middleware'
import { ALERT_SEVERITIES }                     from '../domain/alert.types'
import type { AlertSeverity }                   from '../domain/alert.types'

const AlertSeverityEnum = z.enum([...ALERT_SEVERITIES] as unknown as [AlertSeverity, ...AlertSeverity[]])

const ConfigBodySchema = z.object({
  emailEnabled:    z.boolean().optional(),
  emailRecipients: z.array(z.string().email()).optional(),
  webhookEnabled:  z.boolean().optional(),
  webhookUrl:      z.string().url().nullable().optional(),
  webhookSecret:   z.string().min(16).nullable().optional(),
  minSeverity:     AlertSeverityEnum.optional(),
})

export function createNotificationConfigRouter(service: NotificationService): Router {
  const router = Router()

  // ── GET /notifications/config ──────────────────────────────────────────────
  router.get('/config', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest
    const config = await service.getConfig(tenantId)
    if (!config) {
      res.status(404).json({ error: 'Configuração de notificação não encontrada' })
      return
    }
    // não retorna webhookSecret ao cliente
    const { webhookSecret: _secret, ...safe } = config
    res.json(safe)
  })

  // ── PUT /notifications/config ──────────────────────────────────────────────
  router.put('/config', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest

    let body: z.infer<typeof ConfigBodySchema>
    try {
      body = ConfigBodySchema.parse(req.body)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Body inválido', issues: err.issues })
        return
      }
      throw err
    }

    const config = await service.upsertConfig(tenantId, body)
    const { webhookSecret: _secret, ...safe } = config
    res.json(safe)
  })

  return router
}
