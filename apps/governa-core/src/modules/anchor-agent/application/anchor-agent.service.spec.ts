import { AnchorAgentService }          from './anchor-agent.service'
import { AnchorAgentNotConfiguredError, AnchorAgentMaxTurnsError } from '../domain/anchor-agent.types'
import type { PolicyEngine }            from '../../policies/application/policy.engine'
import type { LlmClient, LlmChatResult } from '../../../shared/ports/llm-client.port'
import type { ToolHandler }             from './protheus-tool-handlers'
import { PROTHEUS_TOOL_DEFS }           from './protheus-tool-handlers'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT = 'tenant-1'
const AGENT  = 'agent-1'

const mockScope = {
  agentId:       AGENT,
  tenantId:      TENANT,
  autonomyLevel: 'CONSULTIVO' as const,
  tools:         [
    { name: 'read_protheus_pedido',  description: 'd', isWrite: false, execute: jest.fn() },
    { name: 'read_protheus_cliente', description: 'd', isWrite: false, execute: jest.fn() },
  ],
  policyId:      'pol-1',
  policyVersion: '1',
}

function makePolicyEngine(opts: {
  scope?: typeof mockScope
  assertBlocks?: string[]
} = {}): jest.Mocked<PolicyEngine> {
  return {
    buildScope: jest.fn().mockResolvedValue(opts.scope ?? mockScope),
    assertToolAllowed: jest.fn().mockImplementation((_scope, toolName: string) => {
      if (opts.assertBlocks?.includes(toolName)) {
        return Promise.reject(new Error(`Tool ${toolName} bloqueada`))
      }
      return Promise.resolve()
    }),
  } as unknown as jest.Mocked<PolicyEngine>
}

function makeTextResult(text: string): LlmChatResult {
  return { stopReason: 'end_turn', content: [{ type: 'text', text }] }
}

function makeToolUseResult(id: string, name: string, input: unknown): LlmChatResult {
  return {
    stopReason: 'tool_use',
    content: [{ type: 'tool_use', id, name, input }],
  }
}

const BASE_INPUT = {
  tenantId:     TENANT,
  agentId:      AGENT,
  subjectToken: 'tok-abc',
  message:      'Qual o status do pedido 123?',
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AnchorAgentService', () => {
  describe('Given llm not configured', () => {
    it('When chat() called, Then throws AnchorAgentNotConfiguredError', async () => {
      const svc = new AnchorAgentService(
        makePolicyEngine(),
        new Map(),
        PROTHEUS_TOOL_DEFS,
        undefined,
      )
      await expect(svc.chat(BASE_INPUT)).rejects.toBeInstanceOf(AnchorAgentNotConfiguredError)
    })
  })

  describe('Given llm returns direct text (no tool_use)', () => {
    it('When chat() called, Then returns reply without tool calls', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(makeTextResult('Pedido 123 em separação.')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)

      const result = await svc.chat(BASE_INPUT)

      expect(result.reply).toBe('Pedido 123 em separação.')
      expect(result.toolCalls).toHaveLength(0)
    })

    it('When chat() called, Then sessionId is present in output', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(makeTextResult('ok')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)

      const result = await svc.chat({ ...BASE_INPUT, sessionId: 'sess-42' })
      expect(result.sessionId).toBe('sess-42')
    })
  })

  describe('Given llm requests tool_use then returns text', () => {
    it('When tool is allowed, Then handler is called and result sent back', async () => {
      const handler: ToolHandler = jest.fn().mockResolvedValue({ pedidos: [{ id: 'p1' }] })
      const handlers = new Map([['read_protheus_pedido', handler]])
      const policyEngine = makePolicyEngine()

      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(makeToolUseResult('tu-1', 'read_protheus_pedido', { numeroPedido: '123' }))
          .mockResolvedValueOnce(makeTextResult('Pedido 123: status ativo.')),
      }

      const svc = new AnchorAgentService(policyEngine, handlers, PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat(BASE_INPUT)

      expect(policyEngine.assertToolAllowed).toHaveBeenCalledWith(mockScope, 'read_protheus_pedido')
      expect(handler).toHaveBeenCalledWith({
        tenantId:     TENANT,
        agentId:      AGENT,
        subjectToken: 'tok-abc',
        params:       { numeroPedido: '123' },
      })
      expect(result.reply).toBe('Pedido 123: status ativo.')
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0]?.toolName).toBe('read_protheus_pedido')
    })

    it('When tool is blocked by policy, Then assertToolAllowed throws and propagates', async () => {
      const policyEngine = makePolicyEngine({ assertBlocks: ['read_protheus_pedido'] })
      const handlers = new Map([['read_protheus_pedido', jest.fn() as ToolHandler]])

      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue(makeToolUseResult('tu-1', 'read_protheus_pedido', {})),
      }

      const svc = new AnchorAgentService(policyEngine, handlers, PROTHEUS_TOOL_DEFS, llm)
      await expect(svc.chat(BASE_INPUT)).rejects.toThrow('bloqueada')
    })
  })

  describe('Given llm keeps returning tool_use indefinitely', () => {
    it('When MAX_TURNS exceeded, Then throws AnchorAgentMaxTurnsError', async () => {
      const handler: ToolHandler = jest.fn().mockResolvedValue({})
      const handlers = new Map([['read_protheus_pedido', handler]])

      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue(makeToolUseResult('tu-x', 'read_protheus_pedido', {})),
      }

      const svc = new AnchorAgentService(makePolicyEngine(), handlers, PROTHEUS_TOOL_DEFS, llm)
      await expect(svc.chat(BASE_INPUT)).rejects.toBeInstanceOf(AnchorAgentMaxTurnsError)
    })
  })

  describe('Given agent scope limits available tools', () => {
    it('When scope excludes a tool, Then its def is not sent to llm', async () => {
      const limitedScope = {
        ...mockScope,
        tools: [{ name: 'read_protheus_pedido', description: 'd', isWrite: false, execute: jest.fn() }],
      }
      const policyEngine = makePolicyEngine({ scope: limitedScope })
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(makeTextResult('ok')) }

      const svc = new AnchorAgentService(policyEngine, new Map(), PROTHEUS_TOOL_DEFS, llm)
      await svc.chat(BASE_INPUT)

      const callArgs = (llm.chat as jest.Mock).mock.calls[0][0]
      const toolNames = callArgs.tools.map((t: { name: string }) => t.name)
      expect(toolNames).toContain('read_protheus_pedido')
      expect(toolNames).not.toContain('read_protheus_cliente')
    })
  })
})
