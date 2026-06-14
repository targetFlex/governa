// ============================================================
// alert.router.ts
//
// Router REST + SSE para o módulo de alertas.
//
// Endpoints:
//   GET  /alerts                       → lista paginada com filtros
//   GET  /alerts/stream                → SSE feed em tempo real
//   GET  /alerts/thresholds            → lista de thresholds configurados
//   PUT  /alerts/thresholds/:kind      → upsert de threshold
//   PATCH /alerts/:id/status           → atualizar status (ack / resolve)
//   POST /alerts/trigger               → disparar alerta (interno / testes)
//
// Segurança:
//   - tenantId sempre extraído do JWT (tenantMiddleware)
//   - Cross-tenant: repo filtra por tenantId → vazio
//
// SSE:
//   - GET /alerts/stream não fecha a conexão — envia eventos enquanto
//     o cliente mantiver a conexão aberta.
//   - Se a conexão cair, o observador é removido automaticamente.
// ============================================================

import { Router, type Request, type Response } from 'express'
import { z, ZodError }                          from 'zod'
import type { AlertService }                    from '../application/alert.service'
import { ALERT_KINDS, ALERT_STATUSES, ALERT_SEVERITIES } from '../domain/alert.types'
import type { AlertKind, AlertStatus, AlertSeverity }    from '../domain/alert.types'
import type { AuthenticatedRequest }            from '../../../shared/middleware/tenant.middleware'

// ─── Schemas de validação ─────────────────────────────────────────────────────

const AlertKindEnum     = z.enum([...ALERT_KINDS]     as unknown as [AlertKind,     ...AlertKind[]])
const AlertStatusEnum   = z.enum([...ALERT_STATUSES]  as unknown as [AlertStatus,   ...AlertStatus[]])
const AlertSeverityEnum = z.enum([...ALERT_SEVERITIES] as unknown as [AlertSeverity, ...AlertSeverity[]])

const ListQuerySchema = z.object({
  agentId: z.string().uuid('agentId deve ser UUID').optional(),
  kind:    AlertKindEnum.optional(),
  status:  AlertStatusEnum.optional(),
  from:    z.string().datetime({ offset: true }).optional(),
  to:      z.string().datetime({ offset: true }).optional(),
  page:    z.coerce.number().int().positive().optional(),
  limit:   z.coerce.number().int().positive().max(100).optional(),
})

const ThresholdBodySchema = z.object({
  enabled:              z.boolean().optional(),
  errorRatePercent:     z.number().min(0).max(100).nullable().optional(),
  volumePerHour:        z.number().int().positive().nullable().optional(),
  checkpointExpiryMin:  z.number().int().positive().nullable().optional(),
})

const StatusBodySchema = z.object({
  status: AlertStatusEnum,
})

const TriggerBodySchema = z.object({
  agentId:  z.string().uuid(),
  kind:     AlertKindEnum,
  severity: AlertSeverityEnum,
  message:  z.string().min(1).max(500),
  metadata: z.record(z.unknown()).optional(),
})

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAlertRouter(service: AlertService): Router {
  const router = Router()

  // ── GET /alerts/stream — SSE feed em tempo real ──────────────────────────
  // Deve vir ANTES de /thresholds e /:id para não ser capturado como param.
  router.get('/stream', (req: Request, res: Response): void => {
    const { tenantId } = req as AuthenticatedRequest

    // Cabeçalhos SSE
    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')  // nginx proxy sem buffer
    res.flushHeaders()

    // Heartbeat a cada 30 s para manter a conexão viva
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n')
    }, 30_000)

    // Inscreve no service — recebe apenas alertas do tenant do JWT
    const unsubscribe = service.subscribe((alert) => {
      if (alert.tenantId !== tenantId) return
      const payload = JSON.stringify(alert)
      res.write(`event: alert\ndata: ${payload}\n\n`)
    })

    // Limpeza quando o cliente desconectar
    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })

  // ── GET /alerts/thresholds ───────────────────────────────────────────────
  router.get('/thresholds', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest
    const thresholds   = await service.listThresholds(tenantId)
    res.json({ data: thresholds })
  })

  // ── PUT /alerts/thresholds/:kind ─────────────────────────────────────────
  router.put('/thresholds/:kind', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest

    let kind: AlertKind
    try {
      kind = AlertKindEnum.parse(req.params['kind'])
    } catch {
      res.status(400).json({ error: 'kind inválido', valid: ALERT_KINDS })
      return
    }

    let body: z.infer<typeof ThresholdBodySchema>
    try {
      body = ThresholdBodySchema.parse(req.body)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Body inválido', issues: err.issues })
        return
      }
      throw err
    }

    const threshold = await service.upsertThreshold(tenantId, kind, body)
    res.json(threshold)
  })

  // ── POST /alerts/trigger — disparo interno / testes ──────────────────────
  router.post('/trigger', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest

    let body: z.infer<typeof TriggerBodySchema>
    try {
      body = TriggerBodySchema.parse(req.body)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Body inválido', issues: err.issues })
        return
      }
      throw err
    }

    const alert = await service.triggerAlert({
      tenantId,
      agentId:  body.agentId,
      kind:     body.kind,
      severity: body.severity,
      message:  body.message,
      metadata: body.metadata,
    })

    res.status(201).json(alert)
  })

  // ── PATCH /alerts/:id/status ─────────────────────────────────────────────
  router.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest
    const { id }       = req.params

    let body: z.infer<typeof StatusBodySchema>
    try {
      body = StatusBodySchema.parse(req.body)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Body inválido', issues: err.issues })
        return
      }
      throw err
    }

    const alert = await service.updateStatus(tenantId, id, body.status)
    res.json(alert)
  })

  // ── GET /alerts ──────────────────────────────────────────────────────────
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest

    let query: z.infer<typeof ListQuerySchema>
    try {
      query = ListQuerySchema.parse(req.query)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Parâmetros inválidos', issues: err.issues })
        return
      }
      throw err
    }

    const page = await service.listAlerts(tenantId, {
      agentId: query.agentId,
      kind:    query.kind,
      status:  query.status,
      from:    query.from   ? new Date(query.from) : undefined,
      to:      query.to     ? new Date(query.to)   : undefined,
      page:    query.page,
      limit:   query.limit,
    })

    res.json(page)
  })

  return router
}
