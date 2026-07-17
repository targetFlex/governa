/**
 * E3.5 Sandbox — 50 interações sintéticas para validação comportamental do Agente Âncora
 *
 * Blocos:
 *   A — Resposta direta (sem tool_use)           6 cenários
 *   B — Consulta de pedido (single tool)          8 cenários
 *   C — Consulta de cliente (single tool)         4 cenários
 *   D — Cadeia de tools (multi-turn / paralelo)   6 cenários
 *   E — Escalonamento USER_REQUESTED              5 cenários
 *   F — Escalonamento SCOPE_EXCEEDED              5 cenários
 *   G — Escalonamento CANNOT_RESOLVE              4 cenários
 *   H — Escalonamento SENSITIVE_TOPIC             3 cenários
 *   I — Escalonamento TOOL_BLOCKED                3 cenários
 *   J — Escalonamento TOOL_ERRORS_EXCEEDED        3 cenários
 *   K — Comportamento do sistema                  3 cenários
 *                                         Total: 50
 */

import { AnchorAgentService }       from './anchor-agent.service'
import { ESCALATE_TOOL_NAME }       from './escalation-tool'
import { AnchorAgentMaxTurnsError } from '../domain/anchor-agent.types'
import { ToolBlockedError }         from '../../policies/application/policy.errors'
import type { PolicyEngine }        from '../../policies/application/policy.engine'
import type { LlmClient, LlmChatResult } from '../../../shared/ports/llm-client.port'
import type { ToolHandler }         from './protheus-tool-handlers'
import { PROTHEUS_TOOL_DEFS }       from './protheus-tool-handlers'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = 'target-flex-sandbox'
const AGENT  = 'agente-atendimento-001'

const defaultScope = {
  agentId:       AGENT,
  tenantId:      TENANT,
  autonomyLevel: 'CONSULTIVO' as const,
  tools: [
    { name: 'read_protheus_pedido',  description: 'd', isWrite: false, source: 'native' as const, execute: jest.fn() },
    { name: 'read_protheus_cliente', description: 'd', isWrite: false, source: 'native' as const, execute: jest.fn() },
  ],
  policyId:      'pol-sandbox',
  policyVersion: '1',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePolicyEngine(opts: {
  scope?:        typeof defaultScope
  blockedTools?: string[]
} = {}): jest.Mocked<PolicyEngine> {
  return {
    buildScope: jest.fn().mockResolvedValue(opts.scope ?? defaultScope),
    assertToolAllowed: jest.fn().mockImplementation((_scope, toolName: string) => {
      if (opts.blockedTools?.includes(toolName)) {
        return Promise.reject(new ToolBlockedError(toolName, 'pol-sandbox', 'sem permissão'))
      }
      return Promise.resolve()
    }),
  } as unknown as jest.Mocked<PolicyEngine>
}

function text(t: string): LlmChatResult {
  return { stopReason: 'end_turn', content: [{ type: 'text', text: t }] }
}

function toolUse(id: string, name: string, input: unknown, prependText?: string): LlmChatResult {
  const content: LlmChatResult['content'] = []
  if (prependText) content.push({ type: 'text', text: prependText })
  content.push({ type: 'tool_use', id, name, input })
  return { stopReason: 'tool_use', content }
}

function parallelTools(...items: Array<{ id: string; name: string; input: unknown }>): LlmChatResult {
  return {
    stopReason: 'tool_use',
    content:    items.map(t => ({ type: 'tool_use' as const, ...t })),
  }
}

function escalate(reason: string, summary: string, prependText?: string): LlmChatResult {
  return toolUse('esc-1', ESCALATE_TOOL_NAME, { reason, summary }, prependText)
}

function ok(value: unknown): ToolHandler { return jest.fn().mockResolvedValue(value) }
function fail(msg = 'Gateway timeout'): ToolHandler { return jest.fn().mockRejectedValue(new Error(msg)) }

const BASE = { tenantId: TENANT, agentId: AGENT, subjectToken: 'hmac-tok-sandbox' }

// Dados de fixture
const PEDIDO_SEPARACAO   = { numeroPedido: '10001', status: 'EM_SEPARACAO',        clienteId: 'CLI-001', previsao: '2026-07-05' }
const PEDIDO_ENTREGUE    = { numeroPedido: '10002', status: 'ENTREGUE',             dataEntrega: '2026-06-20' }
const PEDIDO_CANCELADO   = { numeroPedido: '10003', status: 'CANCELADO',            motivo: 'Solicitação do cliente' }
const PEDIDO_AGUARD_PGTO = { numeroPedido: '10004', status: 'AGUARDANDO_PAGAMENTO', vencimento: '2026-07-01' }
const LISTA_ABERTOS      = { pedidos: [PEDIDO_SEPARACAO, PEDIDO_AGUARD_PGTO] }
const PEDIDO_VAZIO       = { pedidos: [] }

const CLIENTE_PJ       = { clienteId: 'CLI-001', tipo: 'PJ', razaoSocial: 'Empresa Teste LTDA' }
const CLIENTE_PF       = { clienteId: 'CLI-002', tipo: 'PF', nome: 'João Silva' }
const CLIENTE_INADIMPL = { clienteId: 'CLI-003', tipo: 'PJ', saldoEmAberto: 15000, inadimplente: true }
const CLIENTE_VAZIO    = { clientes: [] }

// ─── Sandbox ──────────────────────────────────────────────────────────────────

describe('E3.5 Sandbox — Agente Âncora (50 interações sintéticas)', () => {

  // ══════════════════════════════════════════════════════════════════════════
  // A — Resposta direta (sem tool_use)  ·  6 cenários
  // ══════════════════════════════════════════════════════════════════════════

  describe('Bloco A — Resposta direta (sem tool_use)', () => {

    it('A1 — Saudação recebe boas-vindas sem tool_use', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(text('Bom dia! Como posso ajudá-lo?')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Olá, bom dia!' })
      expect(result.reply).toContain('Bom dia')
      expect(result.toolCalls).toHaveLength(0)
      expect(result.escalation).toBeUndefined()
    })

    it('A2 — Pergunta sobre horário de atendimento respondida sem tool', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(text('Atendemos de seg a sex, das 8h às 18h.')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Qual o horário de atendimento de vocês?' })
      expect(result.toolCalls).toHaveLength(0)
      expect(result.escalation).toBeUndefined()
    })

    it('A3 — Agradecimento encerra sem escalonamento e sem tools', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(text('Fico feliz em ter ajudado!')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Muito obrigado pela ajuda!' })
      expect(result.toolCalls).toHaveLength(0)
      expect(result.escalation).toBeUndefined()
    })

    it('A4 — Pergunta sobre política de trocas sem necessidade de tool', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(text('Nossa política permite trocas em até 30 dias.')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Como funciona a política de trocas?' })
      expect(result.reply).toContain('troca')
      expect(result.toolCalls).toHaveLength(0)
    })

    it('A5 — Mensagem em inglês processada sem tool', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(text('I can help you. Please provide your order number.')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'I need help with my order' })
      expect(result.toolCalls).toHaveLength(0)
    })

    it('A6 — SessionId customizado preservado na resposta', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(text('ok')) }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'teste', sessionId: 'sess-custom-sandbox' })
      expect(result.sessionId).toBe('sess-custom-sandbox')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // B — Consulta de pedido (single tool)  ·  8 cenários
  // ══════════════════════════════════════════════════════════════════════════

  describe('Bloco B — Consulta de pedido (read_protheus_pedido)', () => {

    it('B1 — Pedido em separação consultado e respondido corretamente', async () => {
      const pedidoHandler = ok(PEDIDO_SEPARACAO)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('b1', 'read_protheus_pedido', { numeroPedido: '10001' }))
          .mockResolvedValueOnce(text('Seu pedido 10001 está em separação, previsão 05/07/2026.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Qual o status do meu pedido 10001?' })
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0]!.toolName).toBe('read_protheus_pedido')
      expect(result.escalation).toBeUndefined()
    })

    it('B2 — Pedido entregue — output registra data de entrega', async () => {
      const pedidoHandler = ok(PEDIDO_ENTREGUE)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('b2', 'read_protheus_pedido', { numeroPedido: '10002' }))
          .mockResolvedValueOnce(text('Seu pedido 10002 foi entregue em 20/06/2026.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Meu pedido 10002 foi entregue?' })
      expect(result.toolCalls[0]!.output).toMatchObject({ status: 'ENTREGUE' })
    })

    it('B3 — Pedido cancelado — output registra motivo', async () => {
      const pedidoHandler = ok(PEDIDO_CANCELADO)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('b3', 'read_protheus_pedido', { numeroPedido: '10003' }))
          .mockResolvedValueOnce(text('O pedido 10003 foi cancelado por solicitação do cliente.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'O pedido 10003 foi cancelado?' })
      expect(result.toolCalls[0]!.output).toMatchObject({ status: 'CANCELADO' })
    })

    it('B4 — Pedido aguardando pagamento — output registra vencimento', async () => {
      const pedidoHandler = ok(PEDIDO_AGUARD_PGTO)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('b4', 'read_protheus_pedido', { numeroPedido: '10004' }))
          .mockResolvedValueOnce(text('Pedido 10004 aguardando pagamento, vence 01/07/2026.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Qual o status do pedido 10004?' })
      expect(result.toolCalls[0]!.output).toMatchObject({ status: 'AGUARDANDO_PAGAMENTO' })
    })

    it('B5 — Número formatado (PED-XXXX) passado intacto ao handler', async () => {
      const pedidoHandler = ok(PEDIDO_SEPARACAO)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('b5', 'read_protheus_pedido', { numeroPedido: 'PED-2026-10001' }))
          .mockResolvedValueOnce(text('Pedido encontrado.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      await svc.chat({ ...BASE, message: 'Informe sobre o pedido PED-2026-10001' })
      expect(pedidoHandler).toHaveBeenCalledWith(
        expect.objectContaining({ params: { numeroPedido: 'PED-2026-10001' } })
      )
    })

    it('B6 — Pedido não encontrado — LLM informa sem escalonar', async () => {
      const pedidoHandler = ok(PEDIDO_VAZIO)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('b6', 'read_protheus_pedido', { numeroPedido: '99999' }))
          .mockResolvedValueOnce(text('Não localizei nenhum pedido com o número 99999.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Qual o status do pedido 99999?' })
      expect(result.toolCalls).toHaveLength(1)
      expect(result.escalation).toBeUndefined()
    })

    it('B7 — Consulta por clienteId retorna lista de pedidos em aberto', async () => {
      const pedidoHandler = ok(LISTA_ABERTOS)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('b7', 'read_protheus_pedido', { clienteId: 'CLI-001' }))
          .mockResolvedValueOnce(text('Você tem 2 pedidos em aberto: 10001 e 10004.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      await svc.chat({ ...BASE, message: 'Quais pedidos tenho em aberto?' })
      expect(pedidoHandler).toHaveBeenCalledWith(
        expect.objectContaining({ params: { clienteId: 'CLI-001' } })
      )
    })

    it('B8 — Handler recebe contexto completo (tenantId + agentId + subjectToken + params)', async () => {
      const pedidoHandler = ok(PEDIDO_SEPARACAO)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('b8', 'read_protheus_pedido', { numeroPedido: '10001' }))
          .mockResolvedValueOnce(text('ok')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      await svc.chat({ ...BASE, message: 'Status do pedido 10001' })
      expect(pedidoHandler).toHaveBeenCalledWith({
        tenantId:     TENANT,
        agentId:      AGENT,
        subjectToken: 'hmac-tok-sandbox',
        params:       { numeroPedido: '10001' },
      })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // C — Consulta de cliente (single tool)  ·  4 cenários
  // ══════════════════════════════════════════════════════════════════════════

  describe('Bloco C — Consulta de cliente (read_protheus_cliente)', () => {

    it('C1 — Dados de cliente PJ consultados com sucesso', async () => {
      const clienteHandler = ok(CLIENTE_PJ)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('c1', 'read_protheus_cliente', { clienteId: 'CLI-001' }))
          .mockResolvedValueOnce(text('Empresa Teste LTDA registrada no Protheus.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_cliente', clienteHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Dados do cliente CLI-001' })
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0]!.toolName).toBe('read_protheus_cliente')
      expect(result.toolCalls[0]!.output).toMatchObject({ tipo: 'PJ' })
    })

    it('C2 — Dados de cliente PF retornados corretamente', async () => {
      const clienteHandler = ok(CLIENTE_PF)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('c2', 'read_protheus_cliente', { clienteId: 'CLI-002' }))
          .mockResolvedValueOnce(text('Cliente João Silva identificado.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_cliente', clienteHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Dados do cliente CLI-002' })
      expect(result.toolCalls[0]!.output).toMatchObject({ tipo: 'PF', nome: 'João Silva' })
    })

    it('C3 — Cliente inadimplente detectado e registrado em toolCalls', async () => {
      const clienteHandler = ok(CLIENTE_INADIMPL)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('c3', 'read_protheus_cliente', { clienteId: 'CLI-003' }))
          .mockResolvedValueOnce(text('Cliente com saldo em aberto de R$ 15.000,00.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_cliente', clienteHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'O cliente CLI-003 tem pendências?' })
      expect(result.toolCalls[0]!.output).toMatchObject({ inadimplente: true })
    })

    it('C4 — Cliente não encontrado — LLM informa sem escalonar', async () => {
      const clienteHandler = ok(CLIENTE_VAZIO)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('c4', 'read_protheus_cliente', { clienteId: 'CLI-999' }))
          .mockResolvedValueOnce(text('Não encontrei nenhum cliente com o ID CLI-999.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_cliente', clienteHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Dados do cliente CLI-999' })
      expect(result.escalation).toBeUndefined()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // D — Cadeia de tools (multi-turn / paralelo)  ·  6 cenários
  // ══════════════════════════════════════════════════════════════════════════

  describe('Bloco D — Cadeia de tools (multi-turn / paralelo)', () => {

    it('D1 — Pedido → cliente vinculado (2 tool calls sequenciais)', async () => {
      const handlers = new Map<string, ToolHandler>([
        ['read_protheus_pedido',  ok(PEDIDO_SEPARACAO)],
        ['read_protheus_cliente', ok(CLIENTE_PJ)],
      ])
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('d1a', 'read_protheus_pedido',  { numeroPedido: '10001' }))
          .mockResolvedValueOnce(toolUse('d1b', 'read_protheus_cliente', { clienteId: 'CLI-001' }))
          .mockResolvedValueOnce(text('Pedido 10001 da Empresa Teste LTDA está em separação.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), handlers, PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Mostre o pedido 10001 e os dados do cliente vinculado' })
      expect(result.toolCalls).toHaveLength(2)
      expect(result.toolCalls[0]!.toolName).toBe('read_protheus_pedido')
      expect(result.toolCalls[1]!.toolName).toBe('read_protheus_cliente')
      expect(result.escalation).toBeUndefined()
    })

    it('D2 — Duas tools paralelas na mesma resposta LLM — ambas registradas em toolCalls', async () => {
      const handlers = new Map<string, ToolHandler>([
        ['read_protheus_pedido',  ok(PEDIDO_SEPARACAO)],
        ['read_protheus_cliente', ok(CLIENTE_PJ)],
      ])
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(parallelTools(
            { id: 'd2a', name: 'read_protheus_pedido',  input: { numeroPedido: '10001' } },
            { id: 'd2b', name: 'read_protheus_cliente', input: { clienteId: 'CLI-001' } },
          ))
          .mockResolvedValueOnce(text('Dados de pedido e cliente obtidos simultaneamente.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), handlers, PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Mostre pedido 10001 e cliente CLI-001 ao mesmo tempo' })
      expect(result.toolCalls).toHaveLength(2)
    })

    it('D3 — 3 consultas de pedido em sequência — todas registradas em toolCalls', async () => {
      const pedidoHandler = ok(PEDIDO_SEPARACAO)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('d3a', 'read_protheus_pedido', { numeroPedido: '10001' }))
          .mockResolvedValueOnce(toolUse('d3b', 'read_protheus_pedido', { numeroPedido: '10002' }))
          .mockResolvedValueOnce(toolUse('d3c', 'read_protheus_pedido', { numeroPedido: '10003' }))
          .mockResolvedValueOnce(text('Consultei 3 pedidos: 10001, 10002 e 10003.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Mostre os pedidos 10001, 10002 e 10003' })
      expect(result.toolCalls).toHaveLength(3)
    })

    it('D4 — Handler falha 1x → recupera no retry → resposta normal (toolErrorCount < threshold)', async () => {
      let calls = 0
      const flakyPedido: ToolHandler = jest.fn().mockImplementation(() => {
        calls++
        if (calls === 1) return Promise.reject(new Error('timeout'))
        return Promise.resolve(PEDIDO_SEPARACAO)
      })
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('d4a', 'read_protheus_pedido', { numeroPedido: '10001' }))
          .mockResolvedValueOnce(toolUse('d4b', 'read_protheus_pedido', { numeroPedido: '10001' }))
          .mockResolvedValueOnce(text('Pedido 10001 em separação (após retry).')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', flakyPedido]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Status do pedido 10001' })
      expect(result.escalation).toBeUndefined()
      // Apenas a chamada bem-sucedida é registrada em toolCalls
      expect(result.toolCalls).toHaveLength(1)
    })

    it('D5 — Tool sem handler registrado → error_content enviado ao LLM (sem escalonar)', async () => {
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('d5', 'read_protheus_nf', { numeroPedido: '10001' }))
          .mockResolvedValueOnce(text('Não consegui acessar a nota fiscal neste momento.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Me mostre a nota fiscal do pedido 10001' })
      expect(result.escalation).toBeUndefined()
      expect(result.toolCalls).toHaveLength(0)
      // LLM chamado 2x: 1ª com tool_use, 2ª após receber o error_content
      expect((llm.chat as jest.Mock).mock.calls).toHaveLength(2)
    })

    it('D6 — extractText concatena múltiplos text blocks em sequência', async () => {
      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue({
          stopReason: 'end_turn',
          content: [
            { type: 'text', text: 'Parte 1 da resposta. ' },
            { type: 'text', text: 'Parte 2 da resposta.' },
          ],
        } as LlmChatResult),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'teste' })
      expect(result.reply).toBe('Parte 1 da resposta. Parte 2 da resposta.')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // E — Escalonamento USER_REQUESTED  ·  5 cenários
  // ══════════════════════════════════════════════════════════════════════════

  describe('Bloco E — Escalonamento USER_REQUESTED', () => {

    it('E1 — "Quero falar com um atendente" → escalação USER_REQUESTED', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('USER_REQUESTED', 'Usuário solicitou transferência para atendimento humano.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Quero falar com um atendente humano' })
      expect(result.escalation?.reason).toBe('USER_REQUESTED')
    })

    it('E2 — "Me transfira para cancelamentos" → escalação com apenas 1 chamada ao LLM', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('USER_REQUESTED', 'Usuário quer ser transferido para o setor de cancelamentos.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Me transfira para o setor de cancelamentos por favor' })
      expect(result.escalation?.reason).toBe('USER_REQUESTED')
      expect((llm.chat as jest.Mock).mock.calls).toHaveLength(1)
    })

    it('E3 — "Quero falar com o gerente" → escalação sem consultar o Protheus', async () => {
      const pedidoHandler = ok(PEDIDO_SEPARACAO)
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('USER_REQUESTED', 'Cliente requisitou atendimento com gerência.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Preciso falar com o gerente agora' })
      expect(result.escalation?.reason).toBe('USER_REQUESTED')
      expect(pedidoHandler).not.toHaveBeenCalled()
    })

    it('E4 — "Não quero robô" → reply vazio (sem texto antes da escalação)', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('USER_REQUESTED', 'Usuário recusou atendimento automatizado.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Não quero falar com robô, me passa um humano' })
      expect(result.escalation?.reason).toBe('USER_REQUESTED')
      expect(result.reply).toBe('')
    })

    it('E5 — Escalação com texto prévio → reply preserva a mensagem do Claude', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('USER_REQUESTED', 'Solicitou atendente.', 'Entendido! Vou transferi-lo agora.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Quero falar com alguém' })
      expect(result.reply).toBe('Entendido! Vou transferi-lo agora.')
      expect(result.escalation?.reason).toBe('USER_REQUESTED')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // F — Escalonamento SCOPE_EXCEEDED  ·  5 cenários
  // ══════════════════════════════════════════════════════════════════════════

  describe('Bloco F — Escalonamento SCOPE_EXCEEDED', () => {

    it('F1 — Solicitação de cancelamento de pedido → SCOPE_EXCEEDED', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('SCOPE_EXCEEDED', 'Cliente solicitou cancelamento do pedido 10001.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Preciso cancelar meu pedido 10001' })
      expect(result.escalation?.reason).toBe('SCOPE_EXCEEDED')
    })

    it('F2 — Pedido de reembolso → SCOPE_EXCEEDED', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('SCOPE_EXCEEDED', 'Cliente solicita reembolso do pedido 10002.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Quero meu dinheiro de volta do pedido 10002' })
      expect(result.escalation?.reason).toBe('SCOPE_EXCEEDED')
    })

    it('F3 — Alteração de endereço de entrega → SCOPE_EXCEEDED', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('SCOPE_EXCEEDED', 'Alteração de endereço requer ação de escrita.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Quero mudar o endereço de entrega do pedido 10001' })
      expect(result.escalation?.reason).toBe('SCOPE_EXCEEDED')
    })

    it('F4 — Adição de produto ao pedido → SCOPE_EXCEEDED', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('SCOPE_EXCEEDED', 'Inclusão de item no pedido requer ação além da consulta.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Quero adicionar mais um produto ao pedido 10001' })
      expect(result.escalation?.reason).toBe('SCOPE_EXCEEDED')
    })

    it('F5 — Solicitação de desconto especial → SCOPE_EXCEEDED', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('SCOPE_EXCEEDED', 'Negociação de desconto requer aprovação humana.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Você pode me dar um desconto especial de 20%?' })
      expect(result.escalation?.reason).toBe('SCOPE_EXCEEDED')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // G — Escalonamento CANNOT_RESOLVE  ·  4 cenários
  // ══════════════════════════════════════════════════════════════════════════

  describe('Bloco G — Escalonamento CANNOT_RESOLVE', () => {

    it('G1 — Pedido não encontrado após busca → Claude escolhe escalonar', async () => {
      const pedidoHandler = ok(PEDIDO_VAZIO)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('g1', 'read_protheus_pedido', { numeroPedido: '55555' }))
          .mockResolvedValueOnce(escalate('CANNOT_RESOLVE', 'Pedido 55555 não localizado no Protheus.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Qual o status do pedido 55555?' })
      expect(result.escalation?.reason).toBe('CANNOT_RESOLVE')
      expect(result.toolCalls).toHaveLength(1)
    })

    it('G2 — Cliente não localizado após busca → Claude escalona', async () => {
      const clienteHandler = ok(CLIENTE_VAZIO)
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('g2', 'read_protheus_cliente', { clienteId: 'CLI-X' }))
          .mockResolvedValueOnce(escalate('CANNOT_RESOLVE', 'Cliente CLI-X não localizado no sistema.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_cliente', clienteHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Preciso dos dados do cliente CLI-X com urgência' })
      expect(result.escalation?.reason).toBe('CANNOT_RESOLVE')
    })

    it('G3 — Dados insuficientes na mensagem → Claude escalona sem chamar tools', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('CANNOT_RESOLVE', 'Mensagem insuficiente para identificar o pedido ou cliente.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Estou com um problema urgente no meu pedido' })
      expect(result.escalation?.reason).toBe('CANNOT_RESOLVE')
      expect(result.toolCalls).toHaveLength(0)
    })

    it('G4 — Pedido encontrado com dados inconsistentes → Claude escalona', async () => {
      const pedidoHandler = ok({ numeroPedido: '10001', status: null, clienteId: undefined })
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('g4', 'read_protheus_pedido', { numeroPedido: '10001' }))
          .mockResolvedValueOnce(escalate('CANNOT_RESOLVE', 'Dados do pedido 10001 estão incompletos no sistema.')),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Status detalhado do pedido 10001' })
      expect(result.escalation?.reason).toBe('CANNOT_RESOLVE')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // H — Escalonamento SENSITIVE_TOPIC  ·  3 cenários
  // ══════════════════════════════════════════════════════════════════════════

  describe('Bloco H — Escalonamento SENSITIVE_TOPIC', () => {

    it('H1 — Menção ao Procon → SENSITIVE_TOPIC', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('SENSITIVE_TOPIC', 'Cliente mencionou reclamação no Procon.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Vou reclamar no Procon se isso não for resolvido hoje' })
      expect(result.escalation?.reason).toBe('SENSITIVE_TOPIC')
    })

    it('H2 — Ameaça de processo judicial → SENSITIVE_TOPIC', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('SENSITIVE_TOPIC', 'Cliente ameaçou mover ação judicial contra a empresa.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Vou processar vocês na justiça pelo ocorrido' })
      expect(result.escalation?.reason).toBe('SENSITIVE_TOPIC')
    })

    it('H3 — Menção ao Reclame Aqui com reclamação grave → SENSITIVE_TOPIC', async () => {
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        escalate('SENSITIVE_TOPIC', 'Cliente ameaçou publicar reclamação no Reclame Aqui.')
      )}
      const svc = new AnchorAgentService(makePolicyEngine(), new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Vou postar no Reclame Aqui se não me atenderem direito' })
      expect(result.escalation?.reason).toBe('SENSITIVE_TOPIC')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // I — Escalonamento TOOL_BLOCKED  ·  3 cenários
  // ══════════════════════════════════════════════════════════════════════════

  describe('Bloco I — Escalonamento TOOL_BLOCKED', () => {

    it('I1 — read_protheus_pedido bloqueada pela política → TOOL_BLOCKED imediato', async () => {
      const policyEngine  = makePolicyEngine({ blockedTools: ['read_protheus_pedido'] })
      const pedidoHandler = ok(PEDIDO_SEPARACAO)
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        toolUse('i1', 'read_protheus_pedido', { numeroPedido: '10001' })
      )}
      const svc = new AnchorAgentService(policyEngine, new Map([['read_protheus_pedido', pedidoHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Status do pedido 10001' })
      expect(result.escalation?.reason).toBe('TOOL_BLOCKED')
      expect(result.escalation?.summary).toContain('read_protheus_pedido')
      expect(pedidoHandler).not.toHaveBeenCalled()
    })

    it('I2 — read_protheus_cliente bloqueada → TOOL_BLOCKED sem chamar o handler', async () => {
      const policyEngine   = makePolicyEngine({ blockedTools: ['read_protheus_cliente'] })
      const clienteHandler = ok(CLIENTE_PJ)
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        toolUse('i2', 'read_protheus_cliente', { clienteId: 'CLI-001' })
      )}
      const svc = new AnchorAgentService(policyEngine, new Map([['read_protheus_cliente', clienteHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Dados do cliente CLI-001' })
      expect(result.escalation?.reason).toBe('TOOL_BLOCKED')
      expect(clienteHandler).not.toHaveBeenCalled()
    })

    it('I3 — Summary do TOOL_BLOCKED menciona o nível de autonomia CONSULTIVO', async () => {
      const policyEngine = makePolicyEngine({ blockedTools: ['read_protheus_pedido'] })
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(
        toolUse('i3', 'read_protheus_pedido', {})
      )}
      const svc = new AnchorAgentService(policyEngine, new Map(), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Status pedido' })
      expect(result.escalation?.summary).toContain('CONSULTIVO')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // J — Escalonamento TOOL_ERRORS_EXCEEDED  ·  3 cenários
  // ══════════════════════════════════════════════════════════════════════════

  describe('Bloco J — Escalonamento TOOL_ERRORS_EXCEEDED', () => {

    it('J1 — 2 erros em tools diferentes (cross-tool) → TOOL_ERRORS_EXCEEDED', async () => {
      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue(parallelTools(
          { id: 'j1a', name: 'read_protheus_pedido',  input: { numeroPedido: '10001' } },
          { id: 'j1b', name: 'read_protheus_cliente', input: { clienteId: 'CLI-001' } },
        )),
      }
      const handlers = new Map<string, ToolHandler>([
        ['read_protheus_pedido',  fail('timeout pedido')],
        ['read_protheus_cliente', fail('timeout cliente')],
      ])
      const svc = new AnchorAgentService(makePolicyEngine(), handlers, PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Mostre pedido 10001 e cliente CLI-001' })
      expect(result.escalation?.reason).toBe('TOOL_ERRORS_EXCEEDED')
    })

    it('J2 — 1 erro por turno (2 turnos) → TOOL_ERRORS_EXCEEDED no 2º turno', async () => {
      const failHandler = fail('instabilidade')
      const llm: LlmClient = {
        chat: jest.fn()
          .mockResolvedValueOnce(toolUse('j2a', 'read_protheus_pedido', {}))
          .mockResolvedValueOnce(toolUse('j2b', 'read_protheus_pedido', {})),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', failHandler]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Status do pedido 10001' })
      expect(result.escalation?.reason).toBe('TOOL_ERRORS_EXCEEDED')
      expect((llm.chat as jest.Mock).mock.calls).toHaveLength(2)
    })

    it('J3 — Summary do TOOL_ERRORS_EXCEEDED menciona o count de falhas', async () => {
      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue(parallelTools(
          { id: 'j3a', name: 'read_protheus_pedido', input: {} },
          { id: 'j3b', name: 'read_protheus_pedido', input: {} },
        )),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', fail()]]), PROTHEUS_TOOL_DEFS, llm)
      const result = await svc.chat({ ...BASE, message: 'Status' })
      expect(result.escalation?.summary).toContain('2')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // K — Comportamento do sistema  ·  3 cenários
  // ══════════════════════════════════════════════════════════════════════════

  describe('Bloco K — Comportamento do sistema', () => {

    it('K1 — Scope limitado a 1 tool: tool excluída não chega ao LLM (mas escalate_to_human sim)', async () => {
      const scopeLimitado = {
        ...defaultScope,
        tools: [{ name: 'read_protheus_pedido', description: 'd', isWrite: false, source: 'native' as const, execute: jest.fn() }],
      }
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(text('ok')) }
      const svc = new AnchorAgentService(makePolicyEngine({ scope: scopeLimitado }), new Map(), PROTHEUS_TOOL_DEFS, llm)
      await svc.chat({ ...BASE, message: 'teste' })
      const toolNames = (llm.chat as jest.Mock).mock.calls[0][0].tools.map((t: { name: string }) => t.name)
      expect(toolNames).toContain('read_protheus_pedido')
      expect(toolNames).not.toContain('read_protheus_cliente')
      expect(toolNames).toContain(ESCALATE_TOOL_NAME)
    })

    it('K2 — Scope vazio → apenas escalate_to_human enviado ao LLM', async () => {
      const scopeVazio = { ...defaultScope, tools: [] }
      const llm: LlmClient = { chat: jest.fn().mockResolvedValue(text('ok')) }
      const svc = new AnchorAgentService(makePolicyEngine({ scope: scopeVazio }), new Map(), PROTHEUS_TOOL_DEFS, llm)
      await svc.chat({ ...BASE, message: 'teste' })
      const toolNames = (llm.chat as jest.Mock).mock.calls[0][0].tools.map((t: { name: string }) => t.name)
      expect(toolNames).toEqual([ESCALATE_TOOL_NAME])
    })

    it('K3 — MAX_TURNS atingido após loop infinito → lança AnchorAgentMaxTurnsError', async () => {
      const llm: LlmClient = {
        chat: jest.fn().mockResolvedValue(toolUse('kx', 'read_protheus_pedido', {})),
      }
      const svc = new AnchorAgentService(makePolicyEngine(), new Map([['read_protheus_pedido', ok(PEDIDO_SEPARACAO)]]), PROTHEUS_TOOL_DEFS, llm)
      await expect(svc.chat({ ...BASE, message: 'loop infinito' })).rejects.toBeInstanceOf(AnchorAgentMaxTurnsError)
    })
  })
})
