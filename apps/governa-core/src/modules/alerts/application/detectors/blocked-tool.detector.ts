// ============================================================
// blocked-tool.detector.ts
//
// Detector SRP para eventos TOOL_BLOCKED.
//
// Regra: SEMPRE dispara alerta HIGH quando uma tool é bloqueada
// por política — não há threshold configurável para este kind,
// pois qualquer bloqueio é uma violação de governança relevante.
//
// Implementa ViolationDetector.
// ============================================================

import type { ViolationDetector }    from '../../domain/violation-detector.port'
import type { AlertThreshold }       from '../../domain/alert.types'
import type { TriggerAlertInput }    from '../alert.service'
import type {
  ViolationEvent,
  ToolBlockedEvent,
} from '../../domain/violation-event'

export class BlockedToolDetector implements ViolationDetector {
  canHandle(event: ViolationEvent): boolean {
    return event.kind === 'TOOL_BLOCKED'
  }

  async detect(
    event:      ViolationEvent,
    _thresholds: AlertThreshold[],
  ): Promise<TriggerAlertInput | null> {
    // Pré-condição garantida por PolicyViolationAlertService
    const e = event as ToolBlockedEvent

    return {
      tenantId: e.tenantId,
      agentId:  e.agentId,
      kind:     'TOOL_BLOCKED',
      severity: 'HIGH',
      message:  `Tool "${e.toolName}" bloqueada pelo agente ${e.agentId}: ${e.reason}`,
      metadata: {
        toolName:  e.toolName,
        policyId:  e.policyId,
        reason:    e.reason,
        blockedAt: e.timestamp.toISOString(),
      },
    }
  }
}
