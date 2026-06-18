// ============================================================
// policy-violation-alert.service.ts
//
// Stub da interface do serviço de alertas de violação de política.
// Implementação completa prevista para E5.5 (AlertModule).
//
// PolicyEngine depende desta interface via inversão de dependência
// (opcional — policyViolationAlertSvc?) para disparo best-effort
// quando uma tool é bloqueada (TOOL_BLOCKED).
// ============================================================

export interface PolicyViolationEvent {
  kind:      string
  tenantId:  string
  agentId:   string
  toolName:  string
  policyId:  string
  reason:    string
  timestamp: Date
}

export interface PolicyViolationAlertService {
  evaluate(event: PolicyViolationEvent): Promise<void>
}
