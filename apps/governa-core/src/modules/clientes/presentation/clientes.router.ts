import { Router, type Request, type Response } from 'express'

import type { ConsultarClienteUseCase } from '../application/consultar-cliente.use-case'
import { ClienteNotFoundError } from '../domain/cliente.errors'
import { GatewayUnavailableError } from '../../pedidos/domain/pedido.errors'
import type { AuthenticatedRequest } from '../../../shared/middleware/tenant.middleware'

/**
 * ClientesRouter — camada de apresentação REST para consulta de clientes.
 *
 * Responsabilidades:
 *  - Extrair tenantId do AuthenticatedRequest (injetado pelo tenantMiddleware)
 *  - Mapear query params para ConsultarClienteInput
 *  - Delegar ao ConsultarClienteUseCase — nenhuma regra de negócio aqui
 *  - Mapear erros de domínio para HTTP (404, 502)
 *
 * Campos obrigatórios no request:
 *  - agentId (query param) — identifica o agente que executa a consulta (LGPD)
 *  - subjectToken (query param) — HMAC do sujeito da consulta (LGPD)
 *
 * Filtros opcionais:
 *  - clienteId, documentoToken
 */
export function createClientesRouter(useCase: ConsultarClienteUseCase): Router {
  const router = Router()

  /** GET /clientes — consulta clientes do tenant autenticado */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest

    const { agentId, subjectToken, clienteId, documentoToken, spanId } =
      req.query as Record<string, string | undefined>

    if (!agentId) {
      res.status(400).json({ error: 'agentId obrigatório', code: 'MISSING_AGENT_ID' })
      return
    }

    if (!subjectToken) {
      res.status(400).json({ error: 'subjectToken obrigatório', code: 'MISSING_SUBJECT_TOKEN' })
      return
    }

    try {
      const output = await useCase.execute({
        tenantId,
        agentId,
        subjectToken,
        filtros: { clienteId, documentoToken },
        spanId,
      })

      res.json({
        data:      output.clientes,
        total:     output.clientes.length,
        traceId:   output.traceId,
        latencyMs: output.latencyMs,
      })
    } catch (err) {
      if (err instanceof ClienteNotFoundError) {
        res.status(404).json({ error: err.message, code: err.code })
        return
      }
      if (err instanceof GatewayUnavailableError) {
        res.status(502).json({ error: err.message, code: err.code })
        return
      }
      throw err
    }
  })

  return router
}
