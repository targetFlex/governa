export interface ChatInput {
  readonly tenantId:    string
  readonly agentId:     string
  readonly subjectToken: string   // HMAC LGPD do sujeito (ex: hash do cliente atendido)
  readonly message:     string
  readonly sessionId?:  string    // identificador da conversa (para histórico futuro)
}

export interface ToolCallRecord {
  readonly toolName: string
  readonly input:    unknown
  readonly output:   unknown
}

// ─── Escalonamento (E3.2) ────────────────────────────────────────────────────

/**
 * Razões originadas pelo Claude (via tool `escalate_to_human`):
 *   USER_REQUESTED  — usuário pediu explicitamente falar com humano
 *   SCOPE_EXCEEDED  — solicitação requer ação além da leitura (escrita/cancelamento)
 *   CANNOT_RESOLVE  — Claude não conseguiu resolver com as informações disponíveis
 *   SENSITIVE_TOPIC — reclamação grave / conflito que exige julgamento humano
 *
 * Razões detectadas internamente pelo serviço:
 *   TOOL_BLOCKED         — tool necessária bloqueada pela política de autonomia
 *   TOOL_ERRORS_EXCEEDED — ≥ 2 falhas de handler de tool na mesma sessão
 */
export type EscalationReason =
  | 'USER_REQUESTED'
  | 'SCOPE_EXCEEDED'
  | 'CANNOT_RESOLVE'
  | 'SENSITIVE_TOPIC'
  | 'TOOL_BLOCKED'
  | 'TOOL_ERRORS_EXCEEDED'

export interface EscalationResult {
  readonly reason:  EscalationReason
  readonly summary: string   // contexto para o operador humano
}

export interface ChatOutput {
  readonly reply:      string
  readonly toolCalls:  ToolCallRecord[]
  readonly sessionId:  string
  readonly escalation?: EscalationResult   // presente quando handoff para humano é acionado
}

export class AnchorAgentNotConfiguredError extends Error {
  readonly code = 'ANCHOR_AGENT_NOT_CONFIGURED' as const
  constructor() {
    super('AnchorAgentService: ANTHROPIC_API_KEY não configurada — serviço inativo')
    this.name = 'AnchorAgentNotConfiguredError'
  }
}

export class AnchorAgentMaxTurnsError extends Error {
  readonly code = 'ANCHOR_AGENT_MAX_TURNS' as const
  constructor(maxTurns: number) {
    super(`AnchorAgentService: limite de ${maxTurns} turnos atingido sem resposta final`)
    this.name = 'AnchorAgentMaxTurnsError'
  }
}
