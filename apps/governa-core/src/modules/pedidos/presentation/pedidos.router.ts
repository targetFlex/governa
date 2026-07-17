import { Router, type Request, type Response } from 'express'

import type { ConsultarPedidoUseCase } from '../application/consultar-pedido.use-case'
import { PedidoNotFoundError, GatewayUnavailableError } from '../domain/pedido.errors'
import type { AuthenticatedRequest } from '../../../shared/middleware/tenant.middleware'
import type { AgentService } from '../../agents/application/agent.service'
import { resolvePanelAccess } from '../../agents/application/panel-access.resolver'

/**
 * PedidosRouter — camada de apresentação REST para consulta de pedidos.
 *
 * Responsabilidades:
 *  - Extrair tenantId/userId do AuthenticatedRequest (injetado pelo tenantMiddleware)
 *  - Mapear query params para ConsultarPedidoInput
 *  - Delegar ao ConsultarPedidoUseCase — nenhuma regra de negócio aqui
 *  - Mapear erros de domínio para HTTP (404, 502)
 *
 * Origem do agentId/subjectToken:
 *  - Consulta feita por um agente de IA: vêm no query string (LGPD).
 *  - Listagem via painel administrativo (uso humano, sem agente nem titular
 *    específico): resolvidos automaticamente para o agente sintético do
 *    tenant — ver panel-access.resolver.ts.
 *
 * Filtros opcionais:
 *  - numeroPedido, clienteId, dataInicio, dataFim
 */
export function createPedidosRouter(useCase: ConsultarPedidoUseCase, agentService: AgentService): Router {
  const router = Router()

  /** GET /pedidos — consulta pedidos do tenant autenticado */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest

    const { numeroPedido, clienteId, dataInicio, dataFim, spanId } =
      req.query as Record<string, string | undefined>
    let { agentId, subjectToken } = req.query as Record<string, string | undefined>

    if (!agentId && !subjectToken) {
      ;({ agentId, subjectToken } = await resolvePanelAccess(agentService, tenantId))
    }

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
        filtros: { numeroPedido, clienteId, dataInicio, dataFim },
        spanId,
      })

      res.json({
        data:      output.pedidos,
        total:     output.pedidos.length,
        traceId:   output.traceId,
        latencyMs: output.latencyMs,
      })
    } catch (err) {
      if (err instanceof PedidoNotFoundError) {
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
