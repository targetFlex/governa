// ============================================================
// policy.router.ts
//
// Router REST para gerenciamento de políticas.
//
// Endpoints:
//   GET  /policies        → lista políticas ativas do tenant
//   GET  /policies/:id    → detalhe de uma política
//   PATCH /policies/:id   → atualiza campos da política (nova versão)
//
// Segurança:
//   - tenantId sempre extraído do JWT (tenantMiddleware) — nunca do body
//   - Cross-tenant → 404 (não 403)
// ============================================================

import { Router, type Request, type Response } from 'express'
import { z, ZodError }                          from 'zod'
import type { PolicyService }                   from '../application/policy.service'
import { PolicyNotFoundError }                  from '../application/policy.service'
import type { AuthenticatedRequest }            from '../../../shared/middleware/tenant.middleware'

const UpdatePolicySchema = z.object({
  name:           z.string().min(1).max(120).optional(),
  autonomyLevel:  z.enum(['CONSULTIVO', 'ASSISTIDO', 'AUTONOMO']).optional(),
  allowedActions: z.array(z.string().min(1)).optional(),
  maxValueBrl:    z.number().positive().nullable().optional(),
  timeWindowH:    z.number().int().positive().nullable().optional(),
  approvers:      z.array(z.string().email('Aprovador deve ser e-mail válido')).optional(),
}).strict()

export function createPolicyRouter(service: PolicyService): Router {
  const router = Router()

  /** GET /policies — lista todas as políticas ativas do tenant */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest
    const policies = await service.listPolicies(tenantId)
    res.json({ data: policies, total: policies.length })
  })

  /** GET /policies/:id — detalhe de uma política */
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest
    try {
      const policy = await service.getPolicy(req.params.id, tenantId)
      res.json({ data: policy })
    } catch (err) {
      if (err instanceof PolicyNotFoundError) {
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      throw err
    }
  })

  /** PATCH /policies/:id — atualiza campos; cria nova versão automaticamente */
  router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest

    let body: z.infer<typeof UpdatePolicySchema>
    try {
      body = UpdatePolicySchema.parse(req.body)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Dados inválidos', issues: err.issues })
        return
      }
      throw err
    }

    try {
      const policy = await service.updatePolicy(req.params.id, tenantId, body)
      res.json({ data: policy })
    } catch (err) {
      if (err instanceof PolicyNotFoundError) {
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      throw err
    }
  })

  return router
}
