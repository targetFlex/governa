/**
 * index.ts — Re-exporta a API pública de telemetria do governa-core.
 *
 * NÃO re-exporta tracer.ts — o init do SDK é efeito colateral e deve
 * ser importado diretamente no server.ts como primeiro import.
 */

export {
  recordHttpRequest,
  recordAlertCreated,
  recordAuditEvent,
  recordAgentDecision,
} from './metrics'

export { shutdownTelemetry } from './tracer'
