/**
 * policy-violation-alert.service.ts
 *
 * Orquestra a detecção de violações de política e o disparo de alertas.
 *
 * Responsabilidades (SRP):
 *   - Carregar thresholds do tenant (uma vez por evaluate)
 *   - Iterar detectores registrados
 *   - Chamar AlertService.triggerAlert() para cada input retornado
 *   - Retornar lista de alerts criados
 *
 * Hexagonal: depende APENAS das portas AlertRepository e AlertService.
 * Os detectores são injetados (DI) — extensível sem modificar este arquivo.
 */

import type { AlertRepository }   from '../domain/alert-repository.port'
import type { Alert }             from '../domain/alert.types'
import type { ViolationDetector } from '../domain/violation-detector.port'
import type { ViolationEvent }    from '../domain/violation-event'
import type { AlertService }      from './alert.service'
import type { NotificationService } from './notification.service'
import { recordAlertCreated }     from '../../../infra/telemetry/metrics'

export class PolicyViolationAlertService {
  constructor(
    private readonly alertService:        AlertService,
    private readonly alertRepo:           AlertRepository,
    private readonly detectors:           ViolationDetector[],
    private readonly notificationService: NotificationService | null = null,
  ) {}

  /**
   * Avalia um evento de violação contra todos os detectores registrados.
   *
   * Fluxo por detector:
   *   1. canHandle() → filtra detectores que entendem o event kind
   *   2. detect()    → retorna TriggerAlertInput ou null
   *   3. null        → ignora; non-null → dispara via AlertService
   *
   * @returns Lista de alertas criados (pode ser vazia).
   */
  async evaluate(event: ViolationEvent): Promise<Alert[]> {
    const thresholds = await this.alertRepo.listThresholds(event.tenantId)
    const fired: Alert[] = []

    for (const detector of this.detectors) {
      if (!detector.canHandle(event)) continue

      const input = await detector.detect(event, thresholds)
      if (input === null) continue

      const alert = await this.alertService.triggerAlert(input)
      recordAlertCreated({ kind: alert.kind, severity: alert.severity, tenantId: alert.tenantId })
      fired.push(alert)

      if (this.notificationService) {
        this.notificationService.dispatch(alert).catch((err) =>
          console.error('[NotificationService] dispatch failed', err),
        )
      }
    }

    return fired
  }
}
