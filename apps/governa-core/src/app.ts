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

import { recordHttpRequest }                            from './infra/telemetry'
import { tenantMiddleware }                             from './shared/middleware/tenant.middleware'
import { createAgentRouter }                            from './modules/agents/presentation/agent.router'
import { createPedidosRouter }                          from './modules/pedidos/presentation/pedidos.router'
import { createClientesRouter }                         from './modules/clientes/presentation/clientes.router'
import { createPolicyRouter }                           from './modules/policies/presentation/policy.router'
import { createAuditRouter }                            from './modules/audit/presentation/audit.router'
import { createAlertRouter }                            from './modules/alerts/presentation/alert.router'
import { createViolationRouter }                        from './modules/alerts/presentation/violation.router'
import { createToolCheckRouter }                        from './modules/policies/presentation/tool-check.router'
import { createNotificationConfigRouter }               from './modules/alerts/presentation/notification-config.router'
import { createAnchorAgentRouter }                      from './modules/anchor-agent/presentation/anchor-agent.router'
import { createFluigWebhookRouter }                     from './modules/anchor-agent/presentation/fluig-webhook.router'
import { createPendingActionRouter }                    from './modules/pending-actions/presentation/pending-action.router'

import type { AgentService }                            from './modules/agents/application/agent.service'
import type { ConsultarPedidoUseCase }                  from './modules/pedidos/application/consultar-pedido.use-case'
import type { ConsultarClienteUseCase }                 from './modules/clientes/application/consultar-cliente.use-case'
import type { PolicyService }                           from './modules/policies/application/policy.service'
import type { PolicyEngine }                            from './modules/policies/application/policy.engine'
import type { AuditQueryService }                       from './modules/audit/application/audit.query.service'
import type { AlertService }                            from './modules/alerts/application/alert.service'
import type { PolicyViolationAlertService }             from './modules/alerts/application/policy-violation-alert.service'
import type { NotificationService }                     from './modules/alerts/application/notification.service'
import type { AnchorAgentService }                      from './modules/anchor-agent/application/anchor-agent.service'
import type { FluigWebhookService }                     from './modules/anchor-agent/application/fluig-webhook.service'
import type { PendingActionService }                    from './modules/pending-actions/application/pending-action.service'

// ─── Contrato de dependências injetadas ───────────────────────────────────────

export interface AppDependencies {
  agentService:                 AgentService
  consultarPedidoUseCase:       ConsultarPedidoUseCase
  consultarClienteUseCase:      ConsultarClienteUseCase
  policyService:                PolicyService
  /** E5.3 — PolicyEngine com assertToolAllowed() wired com policyViolationAlertService */
  policyEngine?:                PolicyEngine
  auditQueryService:            AuditQueryService
  alertService:                 AlertService
  policyViolationAlertService:  PolicyViolationAlertService
  notificationService?:         NotificationService
  /** E3.1 — Agente âncora consultivo (opt-in via ANTHROPIC_API_KEY) */
  anchorAgentService?:          AnchorAgentService
  /** E3.3 — Webhook Fluig (opt-in via FLUIG_API_KEY + ANTHROPIC_API_KEY + PII_HMAC_KEY) */
  fluigWebhookService?:         FluigWebhookService
  fluigApiKey?:                 string
  /** E3.4 — Checkpoint humano (PendingAction) */
  pendingActionService?:        PendingActionService
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createApp(deps: AppDependencies): Application {
  const app = express()

  // ── Segurança e parsing ──────────────────────────────────────────────────────
  app.use(helmet())
  app.use(cors())
  app.use(express.json())

  // ── OTel HTTP metrics — mede latência de toda requisição ────────────────────
  app.use((req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now()
    res.on('finish', () => {
      recordHttpRequest({
        method:     req.method,
        route:      req.route?.path ?? req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      })
    })
    next()
  })

  // ── Health check (sem autenticação) ─────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', ts: new Date().toISOString() })
  })

  // ── E3.3: Webhook Fluig — ANTES do tenantMiddleware (auth via X-Fluig-Api-Key) ──
  if (deps.fluigWebhookService && deps.fluigApiKey) {
    app.use('/webhooks', createFluigWebhookRouter(deps.fluigWebhookService, deps.fluigApiKey))
  }

  // ── Autenticação obrigatória para todos os recursos abaixo ──────────────────
  app.use(tenantMiddleware)

  // ── Routers ─────────────────────────────────────────────────────────────────
  app.use('/agents',        createAgentRouter(deps.agentService))
  app.use('/pedidos',       createPedidosRouter(deps.consultarPedidoUseCase))
  app.use('/clientes',      createClientesRouter(deps.consultarClienteUseCase))
  app.use('/policies',      createPolicyRouter(deps.policyService))
  app.use('/audit-events',  createAuditRouter(deps.auditQueryService))
  app.use('/alerts',        createAlertRouter(deps.alertService))
  app.use('/violations',    createViolationRouter(deps.policyViolationAlertService))
  if (deps.notificationService) {
    app.use('/notifications', createNotificationConfigRouter(deps.notificationService))
  }
  // E3.1 — agente âncora (montado apenas se ANTHROPIC_API_KEY estiver configurada)
  if (deps.anchorAgentService) {
    app.use('/anchor-agent', createAnchorAgentRouter(deps.anchorAgentService))
  }
  // E3.4 — checkpoint humano (pending actions)
  if (deps.pendingActionService) {
    app.use('/pending-actions', createPendingActionRouter(deps.pendingActionService))
  }
  // E5.4 — expõe assertToolAllowed() via HTTP (montado apenas se policyEngine disponível)
  if (deps.policyEngine) {
    app.use('/policies',    createToolCheckRouter(deps.policyEngine))
  }

  // ── Erro global (deve ser o último middleware) ───────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('[governa-core] unhandled error', err)
    res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' })
  })

  return app
}
