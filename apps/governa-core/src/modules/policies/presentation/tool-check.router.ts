// ============================================================
// tool-check.router.ts — E5.4
//
// Expõe assertToolAllowed() do PolicyEngine via HTTP.
//
// Endpoint:
//   POST /policies/check-tool
//     Body:    { agentId: string, toolName: string }
//     200 →   { allowed: true,  agentId, toolName, policyId, autonomyLevel }
//     403 →   { allowed: false, code: 'TOOL_BLOCKED', agentId, toolName, policyId, reason }
//     404 →   { error, code: 'AGENT_NOT_FOUND' }
//     422 →   { error, code: 'AGENT_WITHOUT_POLICY' }
//     400 →   { error: 'Dados inválidos', issues: [...] }
//     401 →   tenantMiddleware (sem JWT)
//
// Segurança:
//   - tenantId SEMPRE extraído do JWT (tenantMiddleware) — nunca do body
//   - buildScope garante isolamento multi-tenant na camada de domínio
// ============================================================

import { Router, type Request, type Response } from 'express'
import { z, ZodError }                          from 'zod'
import type { PolicyEngine }                    from '../application/policy.engine'
import {
  AgentNotFoundError,
  AgentWithoutPolicyError,
  ToolBlockedError,
}                                               from '../application/policy.errors'
import type { AuthenticatedRequest }            from '../../../shared/middleware/tenant.middleware'

// ─── Schema de validação ─────────────────────────────────────────────────────

const CheckToolSchema = z.object({
  agentId:  z.string().min(1, 'agentId é obrigatório'),
  toolName: z.string().min(1, 'toolName é obrigatório'),
})
// Campos extras no body são ignorados — tenantId nunca é lido do body

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createToolCheckRouter(engine: PolicyEngine): Router {
  const router = Router()

  /**
   * POST /policies/check-tool
   *
   * Verifica se uma tool está permitida para o agente dado,
   * considerando a política ativa do tenant autenticado.
   *
   * Fluxo:
   *   1. Validar body (agentId + toolName)
   *   2. buildScope(agentId, tenantId) → ToolScope
   *   3. assertToolAllowed(scope, toolName)
   *      - Se permitida → 200 { allowed: true, ... }
   *      - Se bloqueada → 403 { allowed: false, code: TOOL_BLOCKED, ... }
   *
   * Side-effect: se TOOL_BLOCKED, assertToolAllowed() dispara
   * PolicyViolationAlertService.evaluate() em best-effort (fire-and-forget).
   */
  router.post('/check-tool', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest

    // ── 1. Validação do body ──────────────────────────────────────────────────
    let body: z.infer<typeof CheckToolSchema>
    try {
      body = CheckToolSchema.parse(req.body)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Dados inválidos', issues: err.issues })
        return
      }
      throw err
    }

    const { agentId, toolName } = body

    // ── 2. Construir scope (pode lançar AgentNotFoundError / AgentWithoutPolicyError) ──
    try {
      const scope = await engine.buildScope(agentId, tenantId)

      // ── 3. Verificar permissão (pode lançar ToolBlockedError) ──────────────
      try {
        await engine.assertToolAllowed(scope, toolName)
        res.json({
          allowed:       true,
          agentId,
          toolName,
          policyId:      scope.policyId,
          autonomyLevel: scope.autonomyLevel,
        })
      } catch (err) {
        if (err instanceof ToolBlockedError) {
          res.status(403).json({
            allowed:  false,
            code:     err.code,
            agentId,
            toolName: err.toolName,
            policyId: err.policyId,
            reason:   err.reason,
          })
          return
        }
        throw err
      }
    } catch (err) {
      if (err instanceof AgentNotFoundError) {
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      if (err instanceof AgentWithoutPolicyError) {
        res.status(422).json({ error: err.message, code: err.code })
        return
      }
      throw err
    }
  })

  return router
}
