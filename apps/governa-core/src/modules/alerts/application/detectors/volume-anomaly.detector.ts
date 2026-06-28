// ============================================================
// volume-anomaly.detector.ts
//
// Detector SRP para anomalia de volume (VOLUME_ANOMALY).
//
// Regras:
//   - Avalia apenas AUDIT_RECORDED
//   - Janela: última 1 hora antes do timestamp do evento
//   - Dispara se: totalDecisoes >= volumePerHour configurado
//   - Severity escalation por múltiplo do threshold:
//       volume < 2x threshold  → MEDIUM
//       volume < 5x threshold  → HIGH
//       volume >= 5x threshold → CRITICAL
//
// Implementa ViolationDetector.
// ============================================================

import type { ViolationDetector }    from '../../domain/violation-detector.port'
import type { AlertThreshold, AlertSeverity } from '../../domain/alert.types'
import type { TriggerAlertInput }    from '../alert.service'
import type { ViolationEvent, AuditRecordedEvent } from '../../domain/violation-event'
import type { AuditEventRepository } from '../../../audit/domain/audit-event-repository.port'

const WINDOW_MS = 60 * 60 * 1000  // 1 hora

function toSeverity(volume: number, threshold: number): AlertSeverity {
  const ratio = volume / threshold
  if (ratio >= 5) return 'CRITICAL'
  if (ratio >= 2) return 'HIGH'
  return 'MEDIUM'
}

export class VolumeAnomalyDetector implements ViolationDetector {
  constructor(private readonly auditRepo: AuditEventRepository) {}

  canHandle(event: ViolationEvent): boolean {
    return event.kind === 'AUDIT_RECORDED'
  }

  async detect(
    event:      ViolationEvent,
    thresholds: AlertThreshold[],
  ): Promise<TriggerAlertInput | null> {
    const e = event as AuditRecordedEvent

    // Encontra threshold ativo para VOLUME_ANOMALY
    const threshold = thresholds.find(t => t.kind === 'VOLUME_ANOMALY' && t.enabled)
    if (!threshold || threshold.volumePerHour === null) return null

    const from  = new Date(e.timestamp.getTime() - WINDOW_MS)
    const total = await this.auditRepo.countSince(e.tenantId, e.agentId, from)

    if (total < threshold.volumePerHour) return null

    return {
      tenantId: e.tenantId,
      agentId:  e.agentId,
      kind:     'VOLUME_ANOMALY',
      severity: toSeverity(total, threshold.volumePerHour),
      message:  `Volume anômalo: ${total} decisões/hora (threshold: ${threshold.volumePerHour}) — agente ${e.agentId}`,
      metadata: {
        totalDecisionsLastHour:  total,
        thresholdVolumePerHour:  threshold.volumePerHour,
        windowHours:             1,
      },
    }
  }
}
