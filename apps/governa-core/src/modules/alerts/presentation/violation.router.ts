// ============================================================
// violation.router.ts
//
// POST /violations — avalia evento de violação de política
// e retorna alertas disparados.
//
// SEGURANÇA: tenantId SEMPRE do JWT via tenantMiddleware.
//            Nunca aceito do request body.
// ============================================================

import { Router, type Request, type Response } from 'express'
import { z, ZodError }                         from 'zod'
import type { PolicyViolationAlertService }     from '../application/policy-violation-alert.service'
import type { AuthenticatedRequest }            from '../../../shared/middleware/tenant.middleware'

const ViolationBodySchema = z.object({
  kind:     z.enum(['TOOL_BLOCKED', 'AUDIT_RECORDED']),
  agentId:  z.string().min(1, 'agentId é obrigatório'),
  toolName: z.string().optional(),
  policyId: z.string().optional(),
  reason:   z.string().optional(),
  outcome:  z.string().optional(),
})

export function createViolationRouter(
  svc: PolicyViolationAlertService,
): Router {
  const router = Router()

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest

    let body: z.infer<typeof ViolationBodySchema>
    try {
      body = ViolationBodySchema.parse(req.body)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Dados inválidos', issues: err.issues })
        return
      }
      throw err
    }

    const alerts = await svc.evaluate({
      kind:      body.kind,
      tenantId,               // SEMPRE do JWT
      agentId:   body.agentId,
      toolName:  body.toolName,
      policyId:  body.policyId,
      reason:    body.reason,
      outcome:   body.outcome,
      timestamp: new Date(),
    })

    res.json({ alerts })
  })

  return router
}
