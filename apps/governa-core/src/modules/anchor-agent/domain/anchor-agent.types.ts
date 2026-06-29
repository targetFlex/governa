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

export interface ChatOutput {
  readonly reply:     string
  readonly toolCalls: ToolCallRecord[]
  readonly sessionId: string
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
