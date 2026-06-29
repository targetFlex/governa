import { FluigWebhookService }    from './fluig-webhook.service'
import type { AnchorAgentService } from './anchor-agent.service'
import type { SubjectTokenHasher } from '../../../shared/crypto/subject-token'
import type { FluigTicketPayload } from '../domain/fluig-webhook.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_PAYLOAD: FluigTicketPayload = {
  ticketId: 'ticket-001',
  tenantId: 'tenant-1',
  agentId:  'agent-1',
  userId:   'user-fluig-42',
  message:  'Qual o status do meu pedido 123?',
}

function makeAnchorAgent(reply = 'Pedido 123 em separação.', escalation?: object): jest.Mocked<AnchorAgentService> {
  return {
    chat: jest.fn().mockResolvedValue({
      reply,
      toolCalls:  [],
      sessionId:  'sess-1',
      escalation,
    }),
  } as unknown as jest.Mocked<AnchorAgentService>
}

function makeHasher(token = 'hashed-user-token'): jest.Mocked<SubjectTokenHasher> {
  return { hash: jest.fn().mockReturnValue(token) } as unknown as jest.Mocked<SubjectTokenHasher>
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('FluigWebhookService', () => {
  describe('processTicket()', () => {
    it('When valid payload, Then hashes userId and calls AnchorAgentService', async () => {
      const agent  = makeAnchorAgent()
      const hasher = makeHasher('tok-abc')
      const svc    = new FluigWebhookService(agent, hasher)

      await svc.processTicket(VALID_PAYLOAD)

      expect(hasher.hash).toHaveBeenCalledWith('user-fluig-42')
      expect(agent.chat).toHaveBeenCalledWith({
        tenantId:     'tenant-1',
        agentId:      'agent-1',
        subjectToken: 'tok-abc',
        message:      'Qual o status do meu pedido 123?',
      })
    })

    it('When AnchorAgentService resolves, Then returns FluigTicketResponse with ticketId', async () => {
      const svc    = new FluigWebhookService(makeAnchorAgent(), makeHasher())
      const result = await svc.processTicket(VALID_PAYLOAD)

      expect(result.ticketId).toBe('ticket-001')
      expect(result.reply).toBe('Pedido 123 em separação.')
      expect(result.escalation).toBeUndefined()
      expect(result.processedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('When agent returns escalation, Then escalation is included in response', async () => {
      const esc = { reason: 'USER_REQUESTED', summary: 'Usuário pediu humano.' }
      const svc = new FluigWebhookService(makeAnchorAgent('', esc), makeHasher())

      const result = await svc.processTicket(VALID_PAYLOAD)

      expect(result.escalation?.reason).toBe('USER_REQUESTED')
      expect(result.escalation?.summary).toBe('Usuário pediu humano.')
    })

    it('When callbackUrl present, Then callback is attempted (fire-and-forget)', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, { status: 200 })
      )
      const svc = new FluigWebhookService(makeAnchorAgent(), makeHasher())

      await svc.processTicket({ ...VALID_PAYLOAD, callbackUrl: 'https://fluig.example.com/callback' })
      // fire-and-forget — dar tempo para o microtask executar
      await Promise.resolve()

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://fluig.example.com/callback',
        expect.objectContaining({ method: 'POST' }),
      )
      fetchSpy.mockRestore()
    })

    it('When callbackUrl absent, Then fetch is not called', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch')
      const svc = new FluigWebhookService(makeAnchorAgent(), makeHasher())

      await svc.processTicket(VALID_PAYLOAD)
      await Promise.resolve()

      expect(fetchSpy).not.toHaveBeenCalled()
      fetchSpy.mockRestore()
    })

    it('When callback fails, Then error is logged but response is still returned', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))

      const svc = new FluigWebhookService(makeAnchorAgent(), makeHasher())
      const result = await svc.processTicket({ ...VALID_PAYLOAD, callbackUrl: 'https://fluig.example.com/cb' })

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(result.ticketId).toBe('ticket-001')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('callback falhou'),
        expect.any(String),
        expect.any(Error),
      )
      consoleSpy.mockRestore()
    })
  })
})
