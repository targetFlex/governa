/**
 * index.ts — Re-exporta a API pública de telemetria do governa-gateway.
 */

export {
  recordProtheusRequest,
  recordProtheusError,
} from './metrics'

export { shutdownTelemetry } from './tracer'
