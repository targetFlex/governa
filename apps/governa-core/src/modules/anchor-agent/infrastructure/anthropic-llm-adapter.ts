import Anthropic from '@anthropic-ai/sdk'
import type { LlmClient, LlmChatParams, LlmChatResult, LlmContentBlock } from '../../../shared/ports/llm-client.port'

const MODEL = 'claude-sonnet-4-6'

export class AnthropicLlmAdapter implements LlmClient {
  constructor(private readonly client: Anthropic) {}

  async chat(params: LlmChatParams): Promise<LlmChatResult> {
    const response = await this.client.messages.create({
      model:      MODEL,
      max_tokens: params.maxTokens,
      system:     params.system,
      tools:      params.tools as Anthropic.Tool[],
      messages:   params.messages as Anthropic.MessageParam[],
    })

    const content: LlmContentBlock[] = response.content
      .filter(b => b.type === 'text' || b.type === 'tool_use')
      .map(block => {
        if (block.type === 'text') {
          return { type: 'text' as const, text: block.text }
        }
        // type === 'tool_use'
        const tb = block as Anthropic.ToolUseBlock
        return {
          type:  'tool_use' as const,
          id:    tb.id,
          name:  tb.name,
          input: tb.input,
        }
      })

    return {
      stopReason: response.stop_reason as LlmChatResult['stopReason'],
      content,
    }
  }
}
