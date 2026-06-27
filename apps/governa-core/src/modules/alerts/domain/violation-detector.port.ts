// ============================================================
// violation-detector.port.ts — PORTA (hexagonal)
//
// Contrato que cada detector de violação de política deve
// implementar. SRP: cada detector conhece apenas seu kind.
//
// Fluxo:
//   PolicyViolationAlertService
//     → itera detectors registrados
//     → chama canHandle() para filtrar por event kind
//     → chama detect() para obter TriggerAlertInput ou null
//     → se não-null → dispara alert via AlertService
// ============================================================

import type { AlertThreshold }    from './alert.types'
import type { TriggerAlertInput } from '../application/alert.service'
import type { ViolationEvent }    from './violation-event'

export interface ViolationDetector {
  /** Retorna true se este detector sabe avaliar o evento recebido. */
  canHandle(event: ViolationEvent): boolean

  /**
   * Avalia o evento e decide se deve disparar um alerta.
   *
   * Retorna `TriggerAlertInput` se o threshold foi atingido,
   * ou `null` se nenhum alerta deve ser emitido.
   *
   * Pré-condição: `canHandle(event) === true`.
   */
  detect(
    event:      ViolationEvent,
    thresholds: AlertThreshold[],
  ): Promise<TriggerAlertInput | null>
}
