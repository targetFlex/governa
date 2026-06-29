export type PendingActionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'

/**
 * Payload persistido em Json — contexto completo para o operador humano
 * e para a retomada do fluxo Fluig.
 */
export interface PendingActionPayload {
  ticketId:          string
  sessionId:         string
  userMessage:       string
  agentReply:        string
  escalationReason:  string
  escalationSummary: string
  callbackUrl?:      string
}

export interface PendingAction {
  readonly id:          string
  readonly tenantId:    string
  readonly agentId:     string
  readonly toolName:    string            // escalation reason ou nome da tool bloqueada
  readonly payload:     PendingActionPayload
  readonly status:      PendingActionStatus
  readonly approverId:  string | null
  readonly expiresAt:   Date
  readonly createdAt:   Date
  readonly resolvedAt:  Date | null
}
