// ============================================================
// error-rate.detector.ts
//
// Detector SRP para taxa de erro elevada (ERROR_RATE).
//
// Regras:
//   - Avalia apenas AUDIT_RECORDED
//   - Janela: 5 minutos antes do timestamp do evento
//   - Mínimo de amostras: 5 (evita falsos positivos em cold-start)
//   - Conta outcomes 'ERROR' e 'DENIED' como erros
//   - Severity escalation:
//       rate < 30%  → MEDIUM
//       rate < 60%  → HIGH
//       rate >= 60% → CRITICAL
//
// Implementa ViolationDetector.
// ============================================================

import type { ViolationDetector }    from '../../domain/violation-detector.port'
import type { AlertThreshold, AlertSeverity } from '../../domain/alert.types'
import type { TriggerAlertInput }    from '../alert.service'
import type { ViolationEvent, AuditRecordedEvent } from '../../domain/violation-event'
import type { AuditEventRepository } from '../../../audit/domain/audit-event-repository.port'

const WINDOW_MS    = 5 * 60 * 1000  // 5 minutos
const MIN_SAMPLES  = 5

function toSeverity(rate: number): AlertSeverity {
  if (rate >= 60) return 'CRITICAL'
  if (rate >= 30) return 'HIGH'
  return 'MEDIUM'
}

export class ErrorRateDetector implements ViolationDetector {
  constructor(private readonly auditRepo: AuditEventRepository) {}

  canHandle(event: ViolationEvent): boolean {
    return event.kind === 'AUDIT_RECORDED'
  }

  async detect(
    event:      ViolationEvent,
    thresholds: AlertThreshold[],
  ): Promise<TriggerAlertInput | null> {
    const e = event as AuditRecordedEvent

    // Encontra threshold ativo para ERROR_RATE
    const threshold = thresholds.find(t => t.kind === 'ERROR_RATE' && t.enabled)
    if (!threshold || threshold.errorRatePercent === null) return null

    const from  = new Date(e.timestamp.getTime() - WINDOW_MS)

    const [total, errors] = await Promise.all([
      this.auditRepo.countSince(e.tenantId, e.agentId, from),
      this.auditRepo.countByOutcomeSince(e.tenantId, e.agentId, 'ERRO', from),
    ])

    if (total < MIN_SAMPLES) return null

    const rate = (errors / total) * 100

    if (rate < threshold.errorRatePercent) return null

    return {
      tenantId: e.tenantId,
      agentId:  e.agentId,
      kind:     'ERROR_RATE',
      severity: toSeverity(rate),
      message:  `Taxa de erro elevada: ${rate.toFixed(1)}% (threshold: ${threshold.errorRatePercent}%) nos últimos 5 min — agente ${e.agentId}`,
      metadata: {
        errorRatePercent:  Math.round(rate),
        totalEvents:       total,
        errorEvents:       errors,
        windowMinutes:     5,
        thresholdPercent:  threshold.errorRatePercent,
      },
    }
  }
}
