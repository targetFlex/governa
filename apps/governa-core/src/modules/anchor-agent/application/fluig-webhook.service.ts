import type { AnchorAgentService }  from './anchor-agent.service'
import type { SubjectTokenHasher }  from '../../../shared/crypto/subject-token'
import type { FluigTicketPayload, FluigTicketResponse } from '../domain/fluig-webhook.types'

export class FluigWebhookService {
  constructor(
    private readonly anchorAgent:   AnchorAgentService,
    private readonly subjectHasher: SubjectTokenHasher,
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
