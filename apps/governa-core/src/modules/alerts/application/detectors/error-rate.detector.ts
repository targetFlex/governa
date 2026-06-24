// ============================================================
// error-rate.detector.ts
//
// Detector stub para taxa de erros.
// Implementação completa prevista para E5.5.
// ============================================================

import type { ViolationDetector, PolicyViolationEvent } from '../policy-violation-alert.service'

export class ErrorRateDetector implements ViolationDetector {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly auditEventRepo: any,
  ) {}

  async detect(_event: PolicyViolationEvent): Promise<void> {
    // E5.5 — lógica de detecção de taxa de erro
    void this.auditEventRepo
  }
}
