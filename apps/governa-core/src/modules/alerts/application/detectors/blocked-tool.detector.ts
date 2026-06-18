// ============================================================
// blocked-tool.detector.ts
//
// Detector stub para eventos TOOL_BLOCKED.
// Implementação completa prevista para E5.5.
// ============================================================

import type { ViolationDetector, PolicyViolationEvent } from '../policy-violation-alert.service'

export class BlockedToolDetector implements ViolationDetector {
  async detect(_event: PolicyViolationEvent): Promise<void> {
    // E5.5 — lógica de detecção de TOOL_BLOCKED
  }
}
