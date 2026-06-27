// ============================================================
// violation-event.ts
//
// Tipos de eventos de violação de política que disparam a
// avaliação de alertas pelo PolicyViolationAlertService.
//
// Dois kinds:
//   TOOL_BLOCKED    — agente tentou usar tool negada pela política
//   AUDIT_RECORDED  — evento de auditoria gravado (base para error
//                     rate e volume anomaly)
// ============================================================

import type { Outcome } from '../../audit/domain/outcome'

// ─── TOOL_BLOCKED ─────────────────────────────────────────────────────────────

export interface ToolBlockedEvent {
  kind:      'TOOL_BLOCKED'
  tenantId:  string
  agentId:   string
  toolName:  string   // nome da tool que foi negada
  policyId:  string   // política que negou
  reason:    string   // ex: "autonomyLevel CONSULTIVO não permite escrita"
  timestamp: Date
}

// ─── AUDIT_RECORDED ───────────────────────────────────────────────────────────

export interface AuditRecordedEvent {
  kind:      'AUDIT_RECORDED'
  tenantId:  string
  agentId:   string
  outcome:   Outcome  // EXECUTADO | BLOQUEADO | AGUARDANDO | ESCALADO | ERRO
  timestamp: Date
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type ViolationEvent = ToolBlockedEvent | AuditRecordedEvent
