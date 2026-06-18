// ============================================================
// volume-anomaly.detector.ts
//
// Detector stub para anomalia de volume.
// Implementação completa prevista para E5.5.
// ============================================================

import type { ViolationDetector, PolicyViolationEvent } from '../policy-violation-alert.service'

export class VolumeAnomalyDetector implements ViolationDetector {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly auditEventRepo: any,
  ) {}

  async detect(_event: PolicyViolationEvent): Promise<void> {
    // E5.5 — lógica de detecção de anomalia de volume
    void this.auditEventRepo
  }
}
