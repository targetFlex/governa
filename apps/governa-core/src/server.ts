/**
 * server.ts — Bootstrap do governa-core.
 *
 * Responsabilidades (composição raiz / DI):
 *  1. Ler variáveis de ambiente obrigatórias
 *  2. Instanciar PrismaClient
 *  3. Construir adaptadores de infra (repositórios + HttpGatewayClient)
 *  4. Construir serviços e use-cases de aplicação
 *  5. Passar tudo para createApp() e iniciar o servidor HTTP
 *
 * Variáveis de ambiente requeridas:
 *   DATABASE_URL          — URL do PostgreSQL (Prisma)
 *   GATEWAY_BASE_URL      — URL base do governa-gateway (ex: http://gateway:3001)
 *   JWT_SECRET            — Segredo HS256 para validação do tenantMiddleware
 *   PORT                  — Porta HTTP (default: 3000)
 *
 * Variáveis opcionais:
 *   SMTP_HOST             — Habilita e-mail; se ausente, NotificationService não sobe
 *   SMTP_PORT             — Porta SMTP (default: 587)
 *   SMTP_SECURE           — "true" para TLS (default: false)
 *   SMTP_USER             — Usuário SMTP (opcional)
 *   SMTP_PASS             — Senha SMTP (opcional)
 *   SMTP_FROM             — Remetente (default: governa@aicockpit.com.br)
 */

// ── OpenTelemetry — DEVE ser o primeiro import (monkey-patching antecipado) ──
import './infra/telemetry/tracer'
import { shutdownTelemetry }                from './infra/telemetry'

import 'dotenv/config'
import { PrismaClient }                     from '@prisma/client'

import { createApp }                        from './app'

// ── Infra ────────────────────────────────────────────────────────────────────
import { PrismaAgentInventoryRepository }   from './modules/agents/infrastructure/prisma-agent-inventory.repository'
import { PrismaAuditEventRepository }       from './modules/audit/infrastructure/prisma-audit-event.repository'
import { HttpGatewayClient }                from './shared/infrastructure/http-gateway-client'

// ── Infra adicional ──────────────────────────────────────────────────────────
import { PrismaPolicyRepository }           from './modules/policies/infrastructure/prisma-policy.repository'
import { PrismaAgentRepository }            from './modules/policies/infrastructure/prisma-agent.repository'
import { PrismaAlertRepository }            from './modules/alerts/infrastructure/prisma-alert.repository'
import { PrismaNotificationConfigRepository } from './modules/alerts/infrastructure/prisma-notification-config.repository'

// ── Application ──────────────────────────────────────────────────────────────
import { AgentService }                     from './modules/agents/application/agent.service'
import { AuditService }                     from './modules/audit/application/audit.service'
import { AuditQueryService }                from './modules/audit/application/audit.query.service'
import { ConsultarPedidoUseCase }           from './modules/pedidos/application/consultar-pedido.use-case'
import { ConsultarClienteUseCase }          from './modules/clientes/application/consultar-cliente.use-case'
import { PolicyService }                    from './modules/policies/application/policy.service'
import { PolicyEngine }                     from './modules/policies/application/policy.engine'
import { ToolScopeBuilder }                 from './modules/policies/application/tool-scope.builder'
import { ALL_TOOLS }                        from './shared/tools/tool-registry'
import { AlertService }                     from './modules/alerts/application/alert.service'
import { PolicyViolationAlertService }      from './modules/alerts/application/policy-violation-alert.service'
import { BlockedToolDetector }              from './modules/alerts/application/detectors/blocked-tool.detector'
import { ErrorRateDetector }               from './modules/alerts/application/detectors/error-rate.detector'
import { VolumeAnomalyDetector }           from './modules/alerts/application/detectors/volume-anomaly.detector'
import { NotificationService, NodemailerMailSender, NodeHttpPoster } from './modules/alerts/application/notification.service'

// ── E3.1: Agente âncora ──────────────────────────────────────────────────────
import Anthropic                                        from '@anthropic-ai/sdk'
import { AnthropicLlmAdapter }                          from './modules/anchor-agent/infrastructure/anthropic-llm-adapter'
import { AnchorAgentService }                           from './modules/anchor-agent/application/anchor-agent.service'
import { buildProtheusHandlers, PROTHEUS_TOOL_DEFS }    from './modules/anchor-agent/application/protheus-tool-handlers'
import { FluigWebhookService }                          from './modules/anchor-agent/application/fluig-webhook.service'
import { SubjectTokenHasher }                           from './shared/crypto/subject-token'
import { PrismaPendingActionRepository, type PendingActionPrismaClient } from './modules/pending-actions/infrastructure/prisma-pending-action.repository'
import { PendingActionService }                         from './modules/pending-actions/application/pending-action.service'
import { AuthService }                                  from './modules/auth/application/auth.service'

// ─── Validação de variáveis obrigatórias ─────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`[governa-core] FATAL: variável de ambiente '${name}' não definida`)
    process.exit(1)
  }
  return value
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  const gatewayBaseUrl = requireEnv('GATEWAY_BASE_URL')
  requireEnv('JWT_SECRET')   // lida pelo tenantMiddleware via process.env
  const port = Number(process.env.PORT ?? 3000)

  // ── Prisma ──────────────────────────────────────────────────────────────────
  const prisma = new PrismaClient()
  await prisma.$connect()
  console.log('[governa-core] Prisma conectado')

  // ── Adaptadores de infra ────────────────────────────────────────────────────
  const agentInventoryRepo = new PrismaAgentInventoryRepository(prisma)
  const auditEventRepo     = new PrismaAuditEventRepository(prisma)
  const policyRepo         = new PrismaPolicyRepository(prisma)
  const policyAgentRepo    = new PrismaAgentRepository(prisma)
  const gatewayClient      = new HttpGatewayClient(gatewayBaseUrl)

  // ── E3.4: PendingActionService ───────────────────────────────────────────────
  const pendingActionRepo    = new PrismaPendingActionRepository(prisma as unknown as PendingActionPrismaClient)
  const pendingActionService = new PendingActionService(pendingActionRepo)

  // ── Infra de alertas ────────────────────────────────────────────────────────
  const alertRepo    = new PrismaAlertRepository(prisma)
  const alertService = new AlertService(alertRepo)

  // ── E5.2: PolicyViolationAlertService com detectores ──────────────────────
  const policyViolationAlertService = new PolicyViolationAlertService(
    alertService,
    alertRepo,
    [
      new BlockedToolDetector(),
      new ErrorRateDetector(auditEventRepo),
      new VolumeAnomalyDetector(auditEventRepo),
    ],
  )

  // ── E5.3: serviços que recebem policyViolationAlertService ─────────────────
  const agentService            = new AgentService(agentInventoryRepo)
  // AuditService recebe policyViolationAlertSvc para disparar AUDIT_RECORDED automaticamente
  const auditService            = new AuditService(auditEventRepo, undefined, undefined, policyViolationAlertService)
  const auditQueryService       = new AuditQueryService(auditEventRepo)
  const policyService           = new PolicyService(policyRepo)
  // PolicyEngine recebe policyViolationAlertSvc para disparar TOOL_BLOCKED em assertToolAllowed()
  const policyEngine            = new PolicyEngine(policyAgentRepo, new ToolScopeBuilder(ALL_TOOLS), policyViolationAlertService)
  const consultarPedidoUseCase  = new ConsultarPedidoUseCase(gatewayClient, auditService)
  const consultarClienteUseCase = new ConsultarClienteUseCase(gatewayClient, auditService)

  // ── E5.4: NotificationService (opt-in — ativo somente se SMTP_HOST estiver definido) ──
  const notificationService = process.env.SMTP_HOST
    ? new NotificationService(
        new PrismaNotificationConfigRepository(prisma),
        new NodemailerMailSender({
          host:   process.env.SMTP_HOST,
          port:   Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          user:   process.env.SMTP_USER,
          pass:   process.env.SMTP_PASS,
          from:   process.env.SMTP_FROM ?? 'governa@aicockpit.com.br',
        }),
        new NodeHttpPoster(),
      )
    : undefined

  if (notificationService) {
    console.log('[governa-core] NotificationService ativo (SMTP + webhook)')
  }

  // ── E3.1: AnchorAgentService (opt-in — ativo somente se ANTHROPIC_API_KEY estiver definida) ──
  const anchorAgentService = process.env.ANTHROPIC_API_KEY
    ? new AnchorAgentService(
        policyEngine,
        buildProtheusHandlers(consultarPedidoUseCase, consultarClienteUseCase),
        PROTHEUS_TOOL_DEFS,
        new AnthropicLlmAdapter(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })),
      )
    : undefined

  if (anchorAgentService) {
    console.log('[governa-core] AnchorAgentService ativo (modelo claude-sonnet-5)')
  }

  // ── E3.3: FluigWebhookService (opt-in — requer FLUIG_API_KEY + ANTHROPIC_API_KEY + PII_HMAC_KEY) ──
  const fluigApiKey = process.env.FLUIG_API_KEY
  const fluigWebhookService = anchorAgentService && fluigApiKey && process.env.PII_HMAC_KEY
    ? new FluigWebhookService(
        anchorAgentService,
        new SubjectTokenHasher(process.env.PII_HMAC_KEY),
        pendingActionService,
      )
    : undefined

  if (fluigWebhookService) {
    console.log('[governa-core] FluigWebhookService ativo (POST /webhooks/fluig)')
  }

  // ── Auth local ──────────────────────────────────────────────────────────────
  const authService = new AuthService(prisma)

  // ── App Express ─────────────────────────────────────────────────────────────
  const app = createApp({
    agentService,
    consultarPedidoUseCase,
    consultarClienteUseCase,
    policyService,
    policyEngine,
    auditQueryService,
    alertService,
    policyViolationAlertService,
    notificationService,
    anchorAgentService,
    fluigWebhookService,
    fluigApiKey,
    pendingActionService,
    authService,
  })

  // ── HTTP Server ─────────────────────────────────────────────────────────────
  app.listen(port, () => {
    console.log(`[governa-core] servidor ouvindo na porta ${port}`)
    console.log(`[governa-core] gateway: ${gatewayBaseUrl}`)
  })

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[governa-core] ${signal} recebido — encerrando...`)
    await shutdownTelemetry()
    await prisma.$disconnect()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
}

bootstrap().catch((err) => {
  console.error('[governa-core] erro no bootstrap', err)
  process.exit(1)
})
