import { Router, type Request, type Response } from 'express'
import { z } from 'zod'

import type { FluigWebhookService } from '../application/fluig-webhook.service'
import { AgentNotFoundError, AgentWithoutPolicyError } from '../../policies/application/policy.errors'
import { AnchorAgentNotConfiguredError } from '../domain/anchor-agent.types'

const TicketPayloadSchema = z.object({
  ticketId:    z.string().min(1),
  tenantId:    z.string().min(1),
  agentId:     z.string().min(1),
  userId:      z.string().min(1),
  message:     z.string().min(1).max(8000),
  callbackUrl: z.string().url().optional(),
  metadata:    z.record(z.unknown()).optional(),
})

/**
 * createFluigWebhookRouter — monta o router do webhook Fluig.
 *
 * DEVE ser montado ANTES do tenantMiddleware em app.ts, pois o
 * chamador é o Fluig (externo) e não carrega JWT de usuário.
 * Autenticação via header X-Fluig-Api-Key validado aqui.
 *
 * @param service     FluigWebhookService
 * @param apiKey      Chave compartilhada (FLUIG_API_KEY). Se undefined, rejeita tudo.
 */
export function createFluigWebhookRouter(
  service: FluigWebhookService,
  apiKey:  string,
): Router {
  const router = Router()

  router.post('/fluig', async (req: Request, res: Response): Promise<void> => {
    // Validação do API key
    const receivedKey = req.headers['x-fluig-api-key']
    if (!receivedKey || receivedKey !== apiKey) {
      res.status(401).json({ error: 'API key inválida ou ausente', code: 'UNAUTHORIZED' })
      return
    }

    // Validação do payload
    const parse = TicketPayloadSchema.safeParse(req.body)
    if (!parse.success) {
      res.status(400).json({ error: 'Payload inválido', details: parse.error.flatten() })
      return
    }

    try {
      const response = await service.processTicket(parse.data)
      res.status(200).json(response)
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
      throw err
    }
  })

  return router
}
