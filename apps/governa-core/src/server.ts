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
