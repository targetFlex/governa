import { Router, type Request, type Response } from 'express'

import type { ConsultarClienteUseCase } from '../application/consultar-cliente.use-case'
import { ClienteNotFoundError } from '../domain/cliente.errors'
import { GatewayUnavailableError } from '../../pedidos/domain/pedido.errors'
import type { AuthenticatedRequest } from '../../../shared/middleware/tenant.middleware'
import type { AgentService } from '../../agents/application/agent.service'
import { resolvePanelAccess } from '../../agents/application/panel-access.resolver'
import { parsePagination } from '../../../shared/http/pagination'

/**
 * ClientesRouter — camada de apresentação REST para consulta de clientes.
 *
 * Responsabilidades:
 *  - Extrair tenantId do AuthenticatedRequest (injetado pelo tenantMiddleware)
 *  - Mapear query params para ConsultarClienteInput
 *  - Delegar ao ConsultarClienteUseCase — nenhuma regra de negócio aqui
 *  - Mapear erros de domínio para HTTP (404, 502)
 *
 * Origem do agentId/subjectToken:
 *  - Consulta feita por um agente de IA: vêm no query string (LGPD).
 *  - Listagem via painel administrativo (uso humano, sem agente nem titular
 *    específico): resolvidos automaticamente para o agente sintético do
 *    tenant — ver panel-access.resolver.ts.
 *
 * Filtros opcionais:
 *  - clienteId, documentoToken
 *
 * Painel (uso humano):
 *  - q: busca livre em memória (clienteId/loja — nunca PII, ver use-case)
 *  - page, pageSize: paginação em memória (default 1/20, pageSize máx. 100)
 */
export function createClientesRouter(useCase: ConsultarClienteUseCase, agentService: AgentService): Router {
  const router = Router()

  /** GET /clientes — consulta clientes do tenant autenticado */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req as AuthenticatedRequest

    const { clienteId, documentoToken, spanId, q } =
      req.query as Record<string, string | undefined>
    let { agentId, subjectToken } = req.query as Record<string, string | undefined>

    if (!agentId && !subjectToken) {
      ;({ agentId, subjectToken } = await resolvePanelAccess(agentService, tenantId))
    }

    const { page, pageSize } = parsePagination(req.query as Record<string, string | undefined>)

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
        q,
        paginacao: { page, pageSize },
      })

      res.json({
        data:      output.clientes,
        total:     output.total,
        page,
        pageSize,
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
