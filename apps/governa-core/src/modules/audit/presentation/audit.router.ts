// ============================================================
// audit.router.ts
//
// Router REST para consulta e exportação do audit trail.
//
// Endpoints:
//   GET /audit-events              → lista paginada com filtros
//   GET /audit-events/export       → lista completa para PDF (máx 10 000)
//
// Query params aceitos:
//   agentId  — UUID do agente (opcional)
//   from     — ISO 8601 data/hora início (opcional)
//   to       — ISO 8601 data/hora fim (opcional)
//   outcome  — EXECUTADO | BLOQUEADO | AGUARDANDO | ESCALADO | ERRO
//   page     — 1-based (default 1) — só em /audit-events
//   limit    — default 20, max 100 — só em /audit-events
//
// Segurança:
//   - tenantId sempre extraído do JWT (tenantMiddleware) — nunca da query
//   - Cross-tenant: Prisma filtra por tenantId automaticamente → vazio
// ============================================================

import { Router, type Request, type Response } from 'express'
import { z, ZodError }                          from 'zod'
import type { AuditQueryService }               from '../application/audit.query.service'
import { OUTCOMES, type Outcome }               from '../domain/outcome'
import type { AuthenticatedRequest }            from '../../../shared/middleware/tenant.middleware'

// ─── Schema de query params ───────────────────────────────────────────────────

const OutcomeEnum = z.enum(OUTCOMES as [Outcome, ...Outcome[]])

const ListQuerySchema = z.object({
  agentId: z.string().uuid('agentId deve ser UUID').optional(),
  from:    z.string().datetime({ offset: true, message: 'from deve ser ISO 8601' }).optional(),
  to:      z.string().datetime({ offset: true, message: 'to deve ser ISO 8601' }).optional(),
  outcome: OutcomeEnum.optional(),
  page:    z.coerce.number().int().positive().optional(),
  limit:   z.coerce.number().int().positive().max(100).optional(),
})

const ExportQuerySchema = ListQuerySchema.omit({ page: true, limit: true })

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAuditRouter(service: AuditQueryService): Router {
  const router = Router()

  // ── GET /audit-events/export ────────────────────────────────────────────────
  // Deve vir ANTES de /:id para não ser capturado como parâmetro dinâmico.
  router.get('/export', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest

    let query: z.infer<typeof ExportQuerySchema>
    try {
      query = ExportQuerySchema.parse(req.query)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Parâmetros inválidos', issues: err.issues })
        return
      }
      throw err
    }

    const events = await service.exportEvents(tenantId, {
      agentId: query.agentId,
      from:    query.from    ? new Date(query.from)    : undefined,
      to:      query.to      ? new Date(query.to)      : undefined,
      outcome: query.outcome,
    })

    res.json({ data: events, total: events.length })
  })

  // ── GET /audit-events ──────────────────────────────────────────────────────
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

    const page = await service.listEvents(tenantId, {
      agentId: query.agentId,
      from:    query.from    ? new Date(query.from)    : undefined,
      to:      query.to      ? new Date(query.to)      : undefined,
      outcome: query.outcome,
      page:    query.page,
      limit:   query.limit,
    })

    res.json(page)
  })

  return router
}
