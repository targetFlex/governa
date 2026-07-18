import { v4 as uuidv4 } from 'uuid'

import type { PolicyEngine }   from '../../policies/application/policy.engine'
import { ToolBlockedError }    from '../../policies/application/policy.errors'
import type { LlmClient, LlmMessage, LlmContentBlock, LlmToolDef } from '../../../shared/ports/llm-client.port'
import type { ToolHandler }    from './protheus-tool-handlers'
import type { AgentInventoryRepository } from '../../agents/domain/agent-inventory-repository.port'
import { resolveMcpCatalog, EMPTY_MCP_CATALOG } from './mcp-catalog-resolver'
import { ESCALATE_TOOL_DEF, ESCALATE_TOOL_NAME, type EscalateToolInput } from './escalation-tool'
import {
  AnchorAgentNotConfiguredError,
  AnchorAgentMaxTurnsError,
  type ChatInput,
  type ChatOutput,
  type ToolCallRecord,
} from '../domain/anchor-agent.types'
import { recordAgentDecision } from '../../../infra/telemetry'

const SYSTEM_PROMPT = `Você é um agente de atendimento consultivo da AICOCKPIT, especializado em operações com o ERP Protheus da TOTVS.

Seu papel:
- Responder perguntas sobre pedidos e clientes usando as tools disponíveis
- Buscar dados reais no Protheus antes de afirmar qualquer informação
- Ser objetivo, preciso e profissional
- Não inventar informações — sempre buscar os dados com as tools

Restrições:
- Você opera em modo CONSULTIVO: somente leitura, sem alterar dados
- Nunca exponha dados pessoais além do necessário para responder à pergunta
- Se não encontrar dados, informe claramente ao invés de inventar

Escalonamento para humano (use escalate_to_human quando):
- O usuário pedir explicitamente falar com um humano ou atendente
- A solicitação exigir ação que vai além da consulta (cancelamento, alteração de dados)
- Não for possível resolver a dúvida com as ferramentas disponíveis
- Houver conflito grave ou situação que exige julgamento humano`

const MAX_TURNS          = 10
const TOOL_ERROR_THRESHOLD = 2

export class AnchorAgentService {
  constructor(
    private readonly policyEngine:       PolicyEngine,
    private readonly handlers:           Map<string, ToolHandler>,
    private readonly toolDefs:           readonly LlmToolDef[],
    private readonly llm?:               LlmClient,
    private readonly agentInventoryRepo?: AgentInventoryRepository,
  ) {}

  async chat(input: ChatInput): Promise<ChatOutput> {
    if (!this.llm) throw new AnchorAgentNotConfiguredError()

    const sessionId = input.sessionId ?? uuidv4()

    // 1. Resolver catálogo MCP dos conectores do agente (D34, sessão 2.81) —
    //    dinâmico por chamada, ao contrário de this.toolDefs/this.handlers
    //    (nativo, fixo, injetado no construtor).
    const agentInventory = await this.agentInventoryRepo?.findByIdForTenant(input.agentId, input.tenantId)
    const mcpCatalog = agentInventory
      ? await resolveMcpCatalog(agentInventory.mcpServers)
      : EMPTY_MCP_CATALOG
    const activeHandlers = mcpCatalog.handlers.size > 0
      ? new Map([...this.handlers, ...mcpCatalog.handlers])
      : this.handlers

    // 2. Montar ToolScope e filtrar tool defs disponíveis para este agente
    const scope        = await this.policyEngine.buildScope(input.agentId, input.tenantId, mcpCatalog.policyTools)
    const allowedNames = new Set(scope.tools.map(t => t.name))
    // escalate_to_human é sempre disponível — não passa pelo filtro de governança
    const activeDefs: LlmToolDef[] = [
      ...[...this.toolDefs, ...mcpCatalog.toolDefs].filter(d => allowedNames.has(d.name)),
      ESCALATE_TOOL_DEF,
    ]

    // 2. Tool-use loop
    const messages:        LlmMessage[]     = [{ role: 'user', content: input.message }]
    const toolCallRecords: ToolCallRecord[] = []
    let   toolErrorCount = 0

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const result = await this.llm.chat({
        system:    SYSTEM_PROMPT,
        messages,
        tools:     activeDefs,
        maxTokens: 4096,
      })

      messages.push({ role: 'assistant', content: result.content })

      if (result.stopReason !== 'tool_use') {
        const reply = this.extractText(result.content)
        recordAgentDecision({ outcome: 'approved', tenantId: input.tenantId })
        return { reply, toolCalls: toolCallRecords, sessionId }
      }

      // 3. Executar cada tool_use block
      const toolResults: LlmContentBlock[] = []

      for (const block of result.content) {
        if (block.type !== 'tool_use') continue

        // ── E3.2: escalonamento explícito pelo Claude ────────────────────────
        if (block.name === ESCALATE_TOOL_NAME) {
          const { reason, summary } = block.input as EscalateToolInput
          const reply = this.extractText(result.content)
          recordAgentDecision({ outcome: 'escalated', tenantId: input.tenantId })
          return { reply, toolCalls: toolCallRecords, sessionId, escalation: { reason, summary } }
        }

        // ── E3.2: escalonamento por tool bloqueada (política de governança) ──
        try {
          await this.policyEngine.assertToolAllowed(scope, block.name)
        } catch (err) {
          if (err instanceof ToolBlockedError) {
            const summary = `Tool '${block.name}' necessária para resolver a solicitação está bloqueada pela política de autonomia (${scope.autonomyLevel}).`
            recordAgentDecision({ outcome: 'escalated', tenantId: input.tenantId })
            return {
              reply:     '',
              toolCalls: toolCallRecords,
              sessionId,
              escalation: { reason: 'TOOL_BLOCKED', summary },
            }
          }
          throw err
        }

        // ── Execução do handler ──────────────────────────────────────────────
        const handler = activeHandlers.get(block.name)
        if (!handler) {
          toolResults.push({
            type:        'tool_result',
            tool_use_id: block.id,
            content:     JSON.stringify({ error: `Nenhum handler registrado para '${block.name}'` }),
          })
          continue
        }

        try {
          const output = await handler({
            tenantId:     input.tenantId,
            agentId:      input.agentId,
            subjectToken: input.subjectToken,
            params:       block.input,
          })

          toolCallRecords.push({ toolName: block.name, input: block.input, output })
          toolResults.push({
            type:        'tool_result',
            tool_use_id: block.id,
            content:     JSON.stringify(output),
          })
        } catch (handlerErr) {
          toolErrorCount++
          toolResults.push({
            type:        'tool_result',
            tool_use_id: block.id,
            content:     JSON.stringify({ error: String(handlerErr) }),
          })
        }
      }

      // ── E3.2: escalonamento por excesso de erros de tool ────────────────────
      if (toolErrorCount >= TOOL_ERROR_THRESHOLD) {
        const summary = `${toolErrorCount} falhas consecutivas de ferramentas de consulta ao Protheus na mesma sessão. Possível instabilidade no gateway.`
        recordAgentDecision({ outcome: 'escalated', tenantId: input.tenantId })
        return {
          reply:     '',
          toolCalls: toolCallRecords,
          sessionId,
          escalation: { reason: 'TOOL_ERRORS_EXCEEDED', summary },
        }
      }

      messages.push({ role: 'user', content: toolResults })
    }

    throw new AnchorAgentMaxTurnsError(MAX_TURNS)
  }

  private extractText(content: LlmContentBlock[]): string {
    return content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map(b => b.text)
      .join('')
  }
}
