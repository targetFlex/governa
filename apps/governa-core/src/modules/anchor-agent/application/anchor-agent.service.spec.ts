const mockMcpListTools         = jest.fn()
const mockMcpBuildToolHandlers = jest.fn()

jest.mock('../infrastructure/mcp-client-adapter', () => ({
  McpClientAdapter: jest.fn().mockImplementation((server: { id: string }) => ({
    listTools:         () => mockMcpListTools(server),
    buildToolHandlers: () => mockMcpBuildToolHandlers(server),
  })),
}))

import { AnchorAgentService }          from './anchor-agent.service'
import { ESCALATE_TOOL_NAME }           from './escalation-tool'
import { AnchorAgentNotConfiguredError, AnchorAgentMaxTurnsError } from '../domain/anchor-agent.types'
import { ToolBlockedError }             from '../../policies/application/policy.errors'
import type { PolicyEngine }            from '../../policies/application/policy.engine'
import type { LlmClient, LlmChatResult } from '../../../shared/ports/llm-client.port'
import type { ToolHandler }             from './protheus-tool-handlers'
import { PROTHEUS_TOOL_DEFS }           from './protheus-tool-handlers'
import { InMemoryAgentInventoryRepository } from '../../../../test/fixtures/in-memory-agent-inventory.repository'
import type { AgentInventoryEntity }    from '../../agents/domain/agent-inventory.entity'
import type { Tool }                    from '../../policies/domain/tool.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT = 'tenant-1'
const AGENT  = 'agent-1'

const mockScope = {
  agentId:       AGENT,
  tenantId:      TENANT,
  autonomyLevel: 'CONSULTIVO' as const,
  tools:         [
    { name: 'read_protheus_pedido',  description: 'd', isWrite: false, source: 'native' as const, execute: jest.fn() },
    { name: 'read_protheus_cliente', description: 'd', isWrite: false, source: 'native' as const, execute: jest.fn() },
  ] as Tool[],
  policyId:      'pol-1',
  policyVersion: '1',
}

function makePolicyEngine(opts: {
  scope?:         typeof mockScope
  blockedTools?:  string[]
} = {}): jest.Mocked<PolicyEngine> {
  return {
    buildScope: jest.fn().mockResolvedValue(opts.scope ?? mockScope),
    assertToolAllowed: jest.fn().mockImplementation((_scope, toolName: string) => {
      if (opts.blockedTools?.includes(toolName)) {
        return Promise.reject(new ToolBlockedError(toolName, 'pol-1', 'sem permissão'))
      }
      return Promise.resolve()
    }),
  } as unknown as jest.Mocked<PolicyEngine>
}

function makeTextResult(text: string): LlmChatResult {
  return { stopReason: 'end_turn', content: [{ type: 'text', text }] }
}

function makeToolUseResult(id: string, name: string, input: unknown, prependText?: string): LlmChatResult {
  const content: LlmChatResult['content'] = []
  if (prependText) content.push({ type: 'text', text: prependText })
  content.push({ type: 'tool_use', id, name, input })
  return { stopReason: 'tool_use', content }
}

function makeEscalateResult(reason: string, summary: string, prependText?: string): LlmChatResult {
  return makeToolUseResult('esc-1', ESCALATE_TOOL_NAME, { reason, summary }, prependText)
}

const BASE_INPUT = {
  tenantId:     TENANT,
  agentId:      AGENT,
  subjectToken: 'tok-abc',
  message:      'Qual o status do pedido 123?',
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AnchorAgentService', () => {

  // ── Configuração ─────────────────────────────────────────────────────────

  describe('Given llm not configured', () => {
    it('When chat() called, Then throws AnchorAgentNotConfiguredError', async () => {
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, undefined)
      await expect(svc.chat(BASE_INPUT)).rejects.toBeInstanceOf(AnchorAgentNotConfiguredError)
    })
  })

  // ── Fluxo normal ─────────────────────────────────────────────────────────

  describe('Given llm returns direct text (no tool_use)', () => {
    it('When chat() called, Then returns reply without tool calls and no escalation', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(makeTextResult('Pedido 123 em separação.')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)

      const result = await svc.chat(BASE_INPUT)

      expect(result.reply).toBe('Pedido 123 em separação.')
      expect(result.toolCalls).toHaveLength(0)
      expect(result.escalation).toBeUndefined()
    })

    it('When sessionId provided, Then is preserved in output', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(makeTextResult('ok')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)

      const result = await svc.chat({ ...BASE_INPUT, sessionId: 'sess-42' })
      expect(result.sessionId).toBe('sess-42')
    })
  })

  describe('Given llm requests tool_use then returns text', () => {
    it('When tool is allowed, Then handler called and result recorded', async () => {
      const handler: ToolHandler = jest.fn().mockResolvedValue({ pedidos: [{ id: 'p1' }] })
      const handlers = new Map([['read_protheus_pedido', handler]])
      const policyEngine = makePolicyEngine()

      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(makeToolUseResult('tu-1', 'read_protheus_pedido', { numeroPedido: '123' }))
          .mockResolvedValueOnce(makeTextResult('Pedido 123: ativo.')),
      }

      const svc = new AnchorAgentService(policyEngine, handlers, PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat(BASE_INPUT)

      expect(policyEngine.assertToolAllowed).toHaveBeenCalledWith(mockScope, 'read_protheus_pedido')
      expect(handler).toHaveBeenCalledWith({
        tenantId: TENANT, agentId: AGENT, subjectToken: 'tok-abc',
        params: { numeroPedido: '123' },
      })
      expect(result.reply).toBe('Pedido 123: ativo.')
      expect(result.toolCalls).toHaveLength(1)
      expect(result.escalation).toBeUndefined()
    })
  })

  describe('Given MAX_TURNS exceeded', () => {
    it('When llm loops indefinitely, Then throws AnchorAgentMaxTurnsError', async () => {
      const handler: ToolHandler = jest.fn().mockResolvedValue({})
      const handlers = new Map([['read_protheus_pedido', handler]])
      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue(makeToolUseResult('tu-x', 'read_protheus_pedido', {})),
      }

      const svc = new AnchorAgentService(makePolicyEngine(), handlers, PROTHEUS_TOOL_DEFS, llm)
      await expect(svc.chat(BASE_INPUT)).rejects.toBeInstanceOf(AnchorAgentMaxTurnsError)
    })
  })

  // ── E3.2: Escalonamento ──────────────────────────────────────────────────

  describe('E3.2 — Escalonamento via tool escalate_to_human', () => {
    it('When Claude calls escalate_to_human, Then returns escalation without further llm calls', async () => {
      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue(
          makeEscalateResult('USER_REQUESTED', 'Usuário pediu falar com atendente.')
        ),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat(BASE_INPUT)

      expect(result.escalation).toBeDefined()
      expect(result.escalation?.reason).toBe('USER_REQUESTED')
      expect(result.escalation?.summary).toBe('Usuário pediu falar com atendente.')
      expect((llm.chat as jest.Mock).mock.calls).toHaveLength(1)
    })

    it('When Claude escalates with preceding text, Then text is preserved in reply', async () => {
      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue(
          makeEscalateResult('CANNOT_RESOLVE', 'Sem dados suficientes.', 'Vou encaminhar para um humano.')
        ),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat(BASE_INPUT)

      expect(result.reply).toBe('Vou encaminhar para um humano.')
      expect(result.escalation?.reason).toBe('CANNOT_RESOLVE')
    })

    it('When Claude escalates SCOPE_EXCEEDED, Then escalation reason is correct', async () => {
      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue(
          makeEscalateResult('SCOPE_EXCEEDED', 'Usuário solicitou cancelamento de pedido.')
        ),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE_INPUT, message: 'Preciso cancelar meu pedido 123' })

      expect(result.escalation?.reason).toBe('SCOPE_EXCEEDED')
    })

    it('When escalate_to_human is sent to llm, Then it is always included in tool defs', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(makeTextResult('ok')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      await svc.chat(BASE_INPUT)

      const callArgs = (llm.chat as jest.Mock).mock.calls[0][0]
      const toolNames = callArgs.tools.map((t: { name: string }) => t.name)
      expect(toolNames).toContain(ESCALATE_TOOL_NAME)
    })
  })

  describe('E3.2 — Escalonamento por tool bloqueada (TOOL_BLOCKED)', () => {
    it('When assertToolAllowed throws ToolBlockedError, Then escalation TOOL_BLOCKED returned', async () => {
      const policyEngine = makePolicyEngine({ blockedTools: ['read_protheus_pedido'] })
      const handler: ToolHandler = jest.fn()
      const handlers = new Map([['read_protheus_pedido', handler]])

      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue(makeToolUseResult('tu-1', 'read_protheus_pedido', {})),
      }

      const svc = new AnchorAgentService(policyEngine, handlers, PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat(BASE_INPUT)

      expect(result.escalation?.reason).toBe('TOOL_BLOCKED')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('E3.2 — Escalonamento por excesso de erros (TOOL_ERRORS_EXCEEDED)', () => {
    it('When 2 handler errors occur in a session, Then escalation TOOL_ERRORS_EXCEEDED returned', async () => {
      const failingHandler: ToolHandler = jest.fn().mockRejectedValue(new Error('Gateway timeout'))
      const handlers = new Map([['read_protheus_pedido', failingHandler]])

      // 1ª chamada: 2 tool_use do mesmo tool (ambas falham)
      // 2ª chamada: nunca ocorre — escalonamento interrompe o loop
      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue({
          stopReason: 'tool_use',
          content: [
            { type: 'tool_use', id: 'tu-1', name: 'read_protheus_pedido', input: {} },
            { type: 'tool_use', id: 'tu-2', name: 'read_protheus_pedido', input: {} },
          ],
        } as LlmChatResult),
      }

      const svc = new AnchorAgentService(makePolicyEngine(), handlers, PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat(BASE_INPUT)

      expect(result.escalation?.reason).toBe('TOOL_ERRORS_EXCEEDED')
      expect((llm.chat as jest.Mock).mock.calls).toHaveLength(1)
    })

    it('When only 1 handler error, Then escalation is NOT triggered (loop continues)', async () => {
      let callCount = 0
      const flakyHandler: ToolHandler = jest.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) throw new Error('flaky')
        return Promise.resolve({ pedidos: [] })
      })
      const handlers = new Map([['read_protheus_pedido', flakyHandler]])

      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(makeToolUseResult('tu-1', 'read_protheus_pedido', {}))
          .mockResolvedValueOnce(makeToolUseResult('tu-2', 'read_protheus_pedido', {}))
          .mockResolvedValueOnce(makeTextResult('Nenhum pedido encontrado.')),
      }

      const svc = new AnchorAgentService(makePolicyEngine(), handlers, PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat(BASE_INPUT)

      expect(result.escalation).toBeUndefined()
      expect(result.reply).toBe('Nenhum pedido encontrado.')
    })
  })

  describe('E3.2 — escalate_to_human não passa por assertToolAllowed', () => {
    it('When Claude calls escalate_to_human, Then assertToolAllowed is NOT called for it', async () => {
      const policyEngine = makePolicyEngine()
      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue(makeEscalateResult('USER_REQUESTED', 'ok')),
      }

      const svc = new AnchorAgentService(policyEngine, new Map(), PROTHEUS_TOOL_DEFS, llm)
      await svc.chat(BASE_INPUT)

      expect(policyEngine.assertToolAllowed).not.toHaveBeenCalled()
    })
  })

  describe('Given agent scope limits available tools', () => {
    it('When scope excludes a tool, Then its def is not sent to llm (but escalate_to_human is)', async () => {
      const limitedScope = {
        ...mockScope,
        tools: [{ name: 'read_protheus_pedido', description: 'd', isWrite: false, source: 'native' as const, execute: jest.fn() }],
      }
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(makeTextResult('ok')) }
      const svc = new AnchorAgentService(makePolicyEngine({ scope: limitedScope }), new Map(), PROTHEUS_TOOL_DEFS, llm)
      await svc.chat(BASE_INPUT)

      const callArgs = (llm.chat as jest.Mock).mock.calls[0][0]
      const toolNames = callArgs.tools.map((t: { name: string }) => t.name)
      expect(toolNames).toContain('read_protheus_pedido')
      expect(toolNames).not.toContain('read_protheus_cliente')
      expect(toolNames).toContain(ESCALATE_TOOL_NAME)
    })
  })

  // ── D34, sessão 2.81: wiring de conectores MCP ───────────────────────────

  describe('Given agent has MCP connectors configured', () => {
    const AGENT_INVENTORY: AgentInventoryEntity = {
      id: AGENT, tenantId: TENANT, name: 'Agente com MCP', description: '', ownerId: 'owner-1',
      policyId: 'pol-1', status: 'ACTIVE', modelId: 'claude-sonnet-5', tools: [],
      systemPrompt: null, skills: [], templateId: null,
      createdAt: new Date(), updatedAt: new Date(), lastActiveAt: null,
      mcpServers: [{ id: 'crm-1', name: 'CRM', url: 'https://mcp.example.com/crm' }],
    }

    function makeInventoryRepo(): InMemoryAgentInventoryRepository {
      const repo = new InMemoryAgentInventoryRepository()
      repo.seed([AGENT_INVENTORY])
      return repo
    }

    beforeEach(() => jest.clearAllMocks())

    it('When policy allows the MCP tool, Then it is sent to the llm and its handler executes', async () => {
      mockMcpListTools.mockResolvedValue([{
        name: 'mcp__crm-1__buscar_lead', description: 'Busca lead',
        input_schema: { type: 'object', properties: {}, required: [] },
      }])
      const mcpHandler = jest.fn().mockResolvedValue({ lead: 'ok' })
      mockMcpBuildToolHandlers.mockResolvedValue(new Map([['mcp__crm-1__buscar_lead', mcpHandler]]))

      const scopeComMcp = {
        ...mockScope,
        tools: [...mockScope.tools, { name: 'mcp__crm-1__buscar_lead', description: 'd', isWrite: false, source: 'mcp' as const, serverId: 'crm-1', execute: jest.fn() }],
      }
      const policyEngine = makePolicyEngine({ scope: scopeComMcp })

      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(makeToolUseResult('tu-1', 'mcp__crm-1__buscar_lead', {}))
          .mockResolvedValueOnce(makeTextResult('Lead encontrado.')),
      }

      const svc = new AnchorAgentService(policyEngine, new Map(), PROTHEUS_TOOL_DEFS, llm, makeInventoryRepo())
      const result = await svc.chat(BASE_INPUT)

      expect(mcpHandler).toHaveBeenCalled()
      expect(result.reply).toBe('Lead encontrado.')
      expect(policyEngine.buildScope).toHaveBeenCalledWith(
        AGENT, TENANT,
        [expect.objectContaining({ name: 'mcp__crm-1__buscar_lead', source: 'mcp', serverId: 'crm-1', isWrite: true })],
      )
    })

    it('When policy scope (CONSULTIVO) excludes the MCP tool, Then it is not sent to the llm', async () => {
      mockMcpListTools.mockResolvedValue([{
        name: 'mcp__crm-1__buscar_lead', description: 'Busca lead',
        input_schema: { type: 'object', properties: {}, required: [] },
      }])
      mockMcpBuildToolHandlers.mockResolvedValue(new Map())

      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(makeTextResult('ok')) }
      // makePolicyEngine() usa mockScope (sem a tool MCP) — simula CONSULTIVO bloqueando isWrite:true
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm, makeInventoryRepo())
      await svc.chat(BASE_INPUT)

      const callArgs = (llm.chat as jest.Mock).mock.calls[0][0]
      const toolNames = callArgs.tools.map((t: { name: string }) => t.name)
      expect(toolNames).not.toContain('mcp__crm-1__buscar_lead')
    })

    it('When agentInventoryRepo is not provided, Then chat works without attempting MCP resolution', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(makeTextResult('ok')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)

      await svc.chat(BASE_INPUT)

      expect(mockMcpListTools).not.toHaveBeenCalled()
    })

    it('When agent has no MCP connectors, Then chat works without connecting to any adapter', async () => {
      const repo = new InMemoryAgentInventoryRepository()
      repo.seed([{ ...AGENT_INVENTORY, mcpServers: [] }])

      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(makeTextResult('ok')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm, repo)

      await svc.chat(BASE_INPUT)

      expect(mockMcpListTools).not.toHaveBeenCalled()
    })
  })
})
