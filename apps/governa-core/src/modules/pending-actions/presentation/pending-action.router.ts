import { Router, type Response } from 'express'
import { z } from 'zod'

import type { PendingActionService }     from '../application/pending-action.service'
import { PendingActionNotFoundError, PendingActionAlreadyResolvedError } from '../application/pending-action.service'
import type { AuthenticatedRequest }     from '../../../shared/middleware/tenant.middleware'

const ResolveBodySchema = z.object({
  approverId:      z.string().min(1),
  responseMessage: z.string().max(2000).optional(),
})

export function createPendingActionRouter(service: PendingActionService): Router {
  const router = Router()

  // ── GET /pending-actions — lista pendentes do tenant ───────────────────────
  router.get('/', async (req, res: Response): Promise<void> => {
    const { tenantId } = req as unknown as AuthenticatedRequest
    const actions = await service.listPending(tenantId)
    res.json({ data: actions, total: actions.length })
  })

  // ── GET /pending-actions/:id ────────────────────────────────────────────────
  router.get('/:id', async (req, res: Response): Promise<void> => {
    const { tenantId } = req as unknown as AuthenticatedRequest
    try {
      const action = await service.findById(req.params['id']!, tenantId)
      res.json(action)
    } catch (err) {
      if (err instanceof PendingActionNotFoundError) {
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      throw err
    }
  })

  // ── POST /pending-actions/:id/approve ──────────────────────────────────────
  router.post('/:id/approve', async (req, res: Response): Promise<void> => {
    const { tenantId } = req as unknown as AuthenticatedRequest
    const parse = ResolveBodySchema.safeParse(req.body)
    if (!parse.success) {
      res.status(400).json({ error: 'Payload inválido', details: parse.error.flatten() })
      return
    }

    try {
      const action = await service.approve(req.params['id']!, tenantId, parse.data)
      res.json(action)
    } catch (err) {
      if (err instanceof PendingActionNotFoundError) {
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      if (err instanceof PendingActionAlreadyResolvedError) {
        res.status(409).json({ error: err.message, code: err.code })
        return
      }
      throw err
    }
  })

  // ── POST /pending-actions/:id/reject ───────────────────────────────────────
  router.post('/:id/reject', async (req, res: Response): Promise<void> => {
    const { tenantId } = req as unknown as AuthenticatedRequest
    const parse = z.object({ approverId: z.string().min(1) }).safeParse(req.body)
    if (!parse.success) {
      res.status(400).json({ error: 'Payload inválido', details: parse.error.flatten() })
      return
    }

    try {
      const action = await service.reject(req.params['id']!, tenantId, parse.data.approverId)
      res.json(action)
    } catch (err) {
      if (err instanceof PendingActionNotFoundError) {
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      if (err instanceof PendingActionAlreadyResolvedError) {
        res.status(409).json({ error: err.message, code: err.code })
        return
      }
      throw err
    }
  })

  return router
}
