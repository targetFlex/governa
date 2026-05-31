import { Router, type Request, type Response } from 'express'
import { ZodError } from 'zod'

import type { AgentService } from '../application/agent.service'
import { CreateAgentSchema, UpdateAgentSchema } from '../domain/agent.schemas'
import {
  AgentNotFoundError,
  AgentNoPolicyError,
  AgentDeprecatedError,
  AgentInvalidStatusTransitionError,
} from '../domain/agent.errors'
import type { AuthenticatedRequest } from '../../../shared/middleware/tenant.middleware'

/**
 * AgentRouter — camada de apresentação REST.
 *
 * Responsabilidades:
 *  - Extrair tenantId do request autenticado (injetado pelo tenantMiddleware)
 *  - Validar body com Zod (CreateAgentSchema / UpdateAgentSchema)
 *  - Delegar ao AgentService — nenhuma regra de negócio aqui
 *  - Mapear erros de domínio para HTTP (404, 422, 400)
 *
 * Critério #2 — PATCH de tenant errado → 404 (não 403):
 *   AgentNotFoundError é tratado como 404 em todos os endpoints.
 */
export function createAgentRouter(service: AgentService): Router {
  const router = Router()

  /** GET /agents — lista agentes do tenant autenticado */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest
    const agents = await service.listAgents(tenantId)
    res.json({ data: agents, total: agents.length })
  })

  /** GET /agents/:id — detalhe do agente (verifica tenant) */
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest
    try {
      const agent = await service.getAgent(req.params.id, tenantId)
      res.json({ data: agent })
    } catch (err) {
      if (err instanceof AgentNotFoundError) {
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      throw err
    }
  })

  /** POST /agents — cria novo agente (status SANDBOX) */
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest
    let body: ReturnType<typeof CreateAgentSchema.parse>
    try {
      body = CreateAgentSchema.parse(req.body)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Dados inválidos', issues: err.issues })
        return
      }
      throw err
    }

    const agent = await service.createAgent(tenantId, body)
    res.status(201).json({ data: agent })
  })

  /** PATCH /agents/:id — atualiza campos do agente */
  router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest
    let body: ReturnType<typeof UpdateAgentSchema.parse>
    try {
      body = UpdateAgentSchema.parse(req.body)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Dados inválidos', issues: err.issues })
        return
      }
      throw err
    }

    try {
      const agent = await service.updateAgent(req.params.id, tenantId, body)
      res.json({ data: agent })
    } catch (err) {
      if (err instanceof AgentNotFoundError) {
        // Critério #2: 404, não 403 — não vazar existência
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      throw err
    }
  })

  /** POST /agents/:id/pause — pausa agente */
  router.post('/:id/pause', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest
    try {
      const agent = await service.pauseAgent(req.params.id, tenantId)
      res.json({ data: agent })
    } catch (err) {
      if (err instanceof AgentNotFoundError) {
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      if (err instanceof AgentDeprecatedError || err instanceof AgentInvalidStatusTransitionError) {
        res.status(422).json({ error: err.message, code: (err as { code: string }).code })
        return
      }
      throw err
    }
  })

  /** POST /agents/:id/activate — ativa agente (requer policy) */
  router.post('/:id/activate', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest
    try {
      const agent = await service.activateAgent(req.params.id, tenantId)
      res.json({ data: agent })
    } catch (err) {
      if (err instanceof AgentNotFoundError) {
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      if (
        err instanceof AgentNoPolicyError ||
        err instanceof AgentDeprecatedError ||
        err instanceof AgentInvalidStatusTransitionError
      ) {
        res.status(422).json({ error: err.message, code: (err as { code: string }).code })
        return
      }
      throw err
    }
  })

  return router
}
