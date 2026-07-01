import type { AnchorAgentService }   from './anchor-agent.service'
import type { SubjectTokenHasher }   from '../../../shared/crypto/subject-token'
import type { FluigTicketPayload, FluigTicketResponse } from '../domain/fluig-webhook.types'
import type { PendingActionService } from '../../pending-actions/application/pending-action.service'

export class FluigWebhookService {
  constructor(
    private readonly anchorAgent:       AnchorAgentService,
    private readonly subjectHasher:     SubjectTokenHasher,
    private readonly pendingActionSvc?: PendingActionService,
  ) {}

  async processTicket(payload: FluigTicketPayload): Promise<FluigTicketResponse> {
    const subjectToken = this.subjectHasher.hash(payload.userId)

    const output = await this.anchorAgent.chat({
      tenantId:     payload.tenantId,
      agentId:      payload.agentId,
      subjectToken,
      message:      payload.message,
    })

    const response: FluigTicketResponse = {
      ticketId:    payload.ticketId,
      sessionId:   output.sessionId,
      reply:       output.reply,
      escalation:  output.escalation,
      processedAt: new Date().toISOString(),
    }

    // E3.4: criar PendingAction se houve escalonamento
    if (output.escalation && this.pendingActionSvc) {
      await this.pendingActionSvc.create({
        tenantId: payload.tenantId,
        agentId:  payload.agentId,
        toolName: output.escalation.reason,
        payload:  {
          ticketId:          payload.ticketId,
          sessionId:         output.sessionId,
          userMessage:       payload.message,
          agentReply:        output.reply,
          escalationReason:  output.escalation.reason,
          escalationSummary: output.escalation.summary,
          callbackUrl:       payload.callbackUrl,
        },
      }).catch(err => {
        console.error('[FluigWebhookService] criar PendingAction falhou', err)
      })
    }

    // Fire-and-forget: envia resultado ao BPM Fluig se callbackUrl estiver presente
    if (payload.callbackUrl) {
      this.sendCallback(payload.callbackUrl, response).catch(err => {
        console.error('[FluigWebhookService] callback falhou', payload.callbackUrl, err)
      })
    }

    return response
  }

  private async sendCallback(url: string, body: FluigTicketResponse): Promise<void> {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(10_000),
    })
  }
}
