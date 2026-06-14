/**
 * app.ts — Factory do app Express (composição raiz de routers + middleware).
 *
 * Recebe todas as dependências já construídas (DI explícita, hexagonal).
 * Sem new PrismaClient aqui — injeção vem do server.ts (bootstrap).
 *
 * Responsabilidades:
 *  - Registrar middlewares globais (helmet, cors, json, tenantMiddleware)
 *  - Montar routers em seus prefixos (/agents, /pedidos, /clientes, /policies)
 *  - Expor health check (/health)
 *  - Capturar erros não tratados e retornar 500 estruturado
 */

import express, { type Application, type Request, type Response, type NextFunction } from 'express'
import helmet from 'helmet'
import cors   from 'cors'

import { tenantMiddleware }                             from './shared/middleware/tenant.middleware'
import { createAgentRouter }                            from './modules/agents/presentation/agent.router'
import { createPedidosRouter }                          from './modules/pedidos/presentation/pedidos.router'
import { createClientesRouter }                         from './modules/clientes/presentation/clientes.router'
import { createPolicyRouter }                           from './modules/policies/presentation/policy.router'

import type { AgentService }                            from './modules/agents/application/agent.service'
import type { ConsultarPedidoUseCase }                  from './modules/pedidos/application/consultar-pedido.use-case'
import type { ConsultarClienteUseCase }                 from './modules/clientes/application/consultar-cliente.use-case'
import type { PolicyService }                           from './modules/policies/application/policy.service'

// ─── Contrato de dependências injetadas ───────────────────────────────────────

export interface AppDependencies {
  agentService:            AgentService
  consultarPedidoUseCase:  ConsultarPedidoUseCase
  consultarClienteUseCase: ConsultarClienteUseCase
  policyService:           PolicyService
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createApp(deps: AppDependencies): Application {
  const app = express()

  // ── Segurança e parsing ──────────────────────────────────────────────────────
  app.use(helmet())
  app.use(cors())
  app.use(express.json())

  // ── Health check (sem autenticação) ─────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', ts: new Date().toISOString() })
  })

  // ── Autenticação obrigatória para todos os recursos abaixo ──────────────────
  app.use(tenantMiddleware)

  // ── Routers ─────────────────────────────────────────────────────────────────
  app.use('/agents',   createAgentRouter(deps.agentService))
  app.use('/pedidos',  createPedidosRouter(deps.consultarPedidoUseCase))
  app.use('/clientes', createClientesRouter(deps.consultarClienteUseCase))
  app.use('/policies', createPolicyRouter(deps.policyService))

  // ── Erro global (deve ser o último middleware) ───────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('[governa-core] unhandled error', err)
    res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' })
  })

  return app
}
