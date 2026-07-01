import { Router, type Response } from 'express'
import { z } from 'zod'

import type { AnchorAgentService }       from '../application/anchor-agent.service'
import type { AuthenticatedRequest }     from '../../../shared/middleware/tenant.middleware'
import { AnchorAgentNotConfiguredError } from '../domain/anchor-agent.types'
import { AgentNotFoundError, AgentWithoutPolicyError, ToolBlockedError } from '../../policies/application/policy.errors'

const ChatRequestSchema = z.object({
  agentId:      z.string().min(1),
  subjectToken: z.string().min(1),
  message:      z.string().min(1).max(4000),
  sessionId:    z.string().optional(),
})

export function createAnchorAgentRouter(service: AnchorAgentService): Router {
  const router = Router()

  router.post('/chat', async (req, res: Response): Promise<void> => {
    const authedReq = req as AuthenticatedRequest
    const parse = ChatRequestSchema.safeParse(req.body)
    if (!parse.success) {
      res.status(400).json({ error: 'Payload inválido', details: parse.error.flatten() })
      return
    }

    const { agentId, subjectToken, message, sessionId } = parse.data
    const tenantId = authedReq.tenantId

    try {
      const output = await service.chat({ tenantId, agentId, subjectToken, message, sessionId })
      res.json(output)
    } catch (err) {
      if (err instanceof AnchorAgentNotConfiguredError) {
        res.status(503).json({ error: 'Agente âncora não configurado', code: err.code })
        return
      }
      if (err instanceof AgentNotFoundError) {
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      if (err instanceof AgentWithoutPolicyError) {
        res.status(422).json({ error: err.message, code: err.code })
        return
      }
      if (err instanceof ToolBlockedError) {
        res.status(403).json({ error: err.message, code: err.code })
        return
      }
      throw err
    }
  })

  return router
}
