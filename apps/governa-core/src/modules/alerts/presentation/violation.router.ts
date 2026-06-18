// ============================================================
// violation.router.ts
//
// Router stub para violações de política.
// Implementação completa prevista para E5.5.
// ============================================================

import { Router, type Request, type Response } from 'express'
import type { PolicyViolationAlertService }     from '../application/policy-violation-alert.service'

export function createViolationRouter(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _svc: PolicyViolationAlertService,
): Router {
  const router = Router()

  // E5.5 — GET /violations (lista violações registradas)
  router.get('/', (_req: Request, res: Response) => {
    res.json({ data: [], total: 0, page: 1, limit: 20 })
  })

  return router
}
