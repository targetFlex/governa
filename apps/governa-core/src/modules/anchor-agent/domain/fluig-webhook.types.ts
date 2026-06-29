/**
 * Tipos do contrato de webhook Fluig ↔ Governa.
 *
 * Fluig envia um ticket via POST /webhooks/fluig.
 * Governa processa com AnchorAgentService e devolve a resposta.
 * Se callbackUrl estiver presente, Governa também envia o resultado
 * via POST ao callbackUrl (fire-and-forget — para fluxos BPM assíncronos).
 */

export interface FluigTicketPayload {
  readonly ticketId:    string
  readonly tenantId:    string    // tenant governa (Fluig conhece o mapeamento)
  readonly agentId:     string    // agente governa a usar
  readonly userId:      string    // ID do usuário Fluig (hash → subjectToken LGPD)
  readonly message:     string    // conteúdo do ticket / mensagem do cliente
  readonly callbackUrl?: string   // URL BPM para receber o resultado (opcional)
  readonly metadata?:   Record<string, unknown>  // contexto adicional do Fluig
}

export interface FluigTicketResponse {
  readonly ticketId:    string
  readonly sessionId:   string
  readonly reply:       string
  readonly escalation?: {
    readonly reason:  string
    readonly summary: string
  }
  readonly processedAt: string   // ISO 8601
}
