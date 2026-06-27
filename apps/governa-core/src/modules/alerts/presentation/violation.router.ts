// ============================================================
// violation.router.ts
//
// Router REST para eventos de violação de política.
//
// Endpoint:
//   POST /violations — avalia evento e dispara alertas se necessário
//
// Segurança:
//   - tenantId SEMPRE extraído do JWT (tenantMiddleware) — nunca do body
//   - agentId validado (obrigatório)
//   - kind validado (enum TOOL_BLOCKED | AUDIT_RECORDED)
// ============================================================

import { Router, type Request, type Response } from 'express'
import { z, ZodError }                          from 'zod'
import type { PolicyViolationAlertService }     from '../application/policy-violation-alert.service'
import type { AuthenticatedRequest }            from '../../../shared/middleware/tenant.middleware'

// ─── Schemas de validação ─────────────────────────────────────────────────────

const ToolBlockedSchema = z.object({
  kind:     z.literal('TOOL_BLOCKED'),
  agentId:  z.string().min(1, 'agentId é obrigatório'),
  toolName: z.string().min(1),
  policyId: z.string().min(1),
  reason:   z.string().min(1),
})

const AuditRecordedSchema = z.object({
  kind:    z.literal('AUDIT_RECORDED'),
  agentId: z.string().min(1, 'agentId é obrigatório'),
  outcome: z.enum(['EXECUTADO', 'BLOQUEADO', 'AGUARDANDO', 'ESCALADO', 'ERRO']),
})

const ViolationBodySchema = z.discriminatedUnion('kind', [
  ToolBlockedSchema,
  AuditRecordedSchema,
])

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createViolationRouter(svc: PolicyViolationAlertService): Router {
  const router = Router()

  /**
   * POST /violations
   *
   * Recebe um evento de violação (TOOL_BLOCKED ou AUDIT_RECORDED),
   * avalia via PolicyViolationAlertService e retorna alertas disparados.
   *
   * Body: ViolationBodySchema (discriminated union por kind)
   * Response: { alerts: Alert[] }
   */
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

    const now = new Date()

    const event = body.kind === 'TOOL_BLOCKED'
      ? {
          kind:      'TOOL_BLOCKED' as const,
          tenantId,
          agentId:   body.agentId,
          toolName:  body.toolName,
          policyId:  body.policyId,
          reason:    body.reason,
          timestamp: now,
        }
      : {
          kind:      'AUDIT_RECORDED' as const,
          tenantId,
          agentId:   body.agentId,
          outcome:   body.outcome,
          timestamp: now,
        }

    const alerts = await svc.evaluate(event)
    res.json({ alerts })
  })

  return router
}
