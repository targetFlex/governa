import { v4 as uuidv4 } from 'uuid'

import type { PolicyEngine }   from '../../policies/application/policy.engine'
import type { LlmClient, LlmMessage, LlmContentBlock, LlmToolDef } from '../../../shared/ports/llm-client.port'
import type { ToolHandler }    from './protheus-tool-handlers'
import {
  AnchorAgentNotConfiguredError,
  AnchorAgentMaxTurnsError,
  type ChatInput,
  type ChatOutput,
  type ToolCallRecord,
} from '../domain/anchor-agent.types'

const SYSTEM_PROMPT = `Você é um agente de atendimento consultivo da AICOCKPIT, especializado em operações com o ERP Protheus da TOTVS.

Seu papel:
- Responder perguntas sobre pedidos e clientes usando as tools disponíveis
- Buscar dados reais no Protheus antes de afirmar qualquer informação
- Ser objetivo, preciso e profissional
- Não inventar informações — sempre buscar os dados com as tools

Restrições:
- Você opera em modo CONSULTIVO: somente leitura, sem alterar dados
- Nunca exponha dados pessoais além do necessário para responder à pergunta
- Se não encontrar dados, informe claramente ao invés de inventar`

const MAX_TURNS = 10

export class AnchorAgentService {
  constructor(
    private readonly policyEngine: PolicyEngine,
    private readonly handlers:     Map<string, ToolHandler>,
    private readonly toolDefs:     readonly LlmToolDef[],
    private readonly llm?:         LlmClient,
  ) {}

  async chat(input: ChatInput): Promise<ChatOutput> {
    if (!this.llm) throw new AnchorAgentNotConfiguredError()

    const sessionId = input.sessionId ?? uuidv4()

    // 1. Montar ToolScope e filtrar tool defs disponíveis para este agente
    const scope = await this.policyEngine.buildScope(input.agentId, input.tenantId)
    const allowedNames = new Set(scope.tools.map(t => t.name))
    const activeDefs   = this.toolDefs.filter(d => allowedNames.has(d.name))

    // 2. Tool-use loop
    const messages:       LlmMessage[]     = [{ role: 'user', content: input.message }]
    const toolCallRecords: ToolCallRecord[] = []

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const result = await this.llm.chat({
        system:    SYSTEM_PROMPT,
        messages,
        tools:     activeDefs,
        maxTokens: 4096,
      })

      // Adiciona resposta do assistente ao histórico
      messages.push({ role: 'assistant', content: result.content })

      if (result.stopReason !== 'tool_use') {
        const reply = result.content
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map(b => b.text)
          .join('')

        return { reply, toolCalls: toolCallRecords, sessionId }
      }

      // 3. Executar cada tool_use block
      const toolResults: LlmContentBlock[] = []

      for (const block of result.content) {
        if (block.type !== 'tool_use') continue

        // Verifica permissão ANTES de executar (dispara alerta se bloqueada)
        await this.policyEngine.assertToolAllowed(scope, block.name)

        const handler = this.handlers.get(block.name)
        if (!handler) {
          toolResults.push({
            type:        'tool_result',
            tool_use_id: block.id,
            content:     JSON.stringify({ error: `Nenhum handler registrado para '${block.name}'` }),
          })
          continue
        }

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
      }

      messages.push({ role: 'user', content: toolResults })
    }

    throw new AnchorAgentMaxTurnsError(MAX_TURNS)
  }
}
