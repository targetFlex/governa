// ============================================================
// policy-violation-alert.service.ts
//
// Serviço de avaliação de violações de política.
// Implementação completa prevista para E5.5 (AlertModule).
//
// PolicyEngine e AuditService dependem desta classe via DI opcional
// para disparo best-effort de alertas (TOOL_BLOCKED, AUDIT_RECORDED).
// ============================================================

export interface PolicyViolationEvent {
  kind:      string
  tenantId:  string
  agentId:   string
  toolName?: string
  policyId?: string
  reason?:   string
  outcome?:  string
  timestamp: Date
}

export interface ViolationDetector {
  detect(event: PolicyViolationEvent): Promise<void>
}

export class PolicyViolationAlertService {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly alertService: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly alertRepo: any,
    private readonly detectors: ViolationDetector[],
  ) {}

  async evaluate(event: PolicyViolationEvent): Promise<void> {
    // E5.5 — lógica completa de detecção e disparo de alertas
    // Stub: delega para cada detector em best-effort
    for (const detector of this.detectors) {
      try {
        await detector.detect(event)
      } catch (err) {
        console.error('[PolicyViolationAlertService] detector falhou', err)
      }
    }
    // Suprime warnings de unused vars no stub
    void this.alertService
    void this.alertRepo
  }
}
