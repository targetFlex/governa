import type Anthropic from '@anthropic-ai/sdk'

import { AnthropicLlmAdapter } from './anthropic-llm-adapter'
import type { LlmChatParams } from '../../../shared/ports/llm-client.port'

const PARAMS: LlmChatParams = {
  system:    'Você é um agente de atendimento.',
  messages:  [{ role: 'user', content: 'Qual o status do pedido PED-1?' }],
  tools:     [],
  maxTokens: 1024,
}

function makeClient(response: unknown) {
  const create = jest.fn().mockResolvedValue(response)
  const client = { messages: { create } } as unknown as Anthropic
  return { client, create }
}

describe('AnthropicLlmAdapter.chat', () => {
  it('mapeia bloco de texto e stop_reason end_turn', async () => {
    const { client, create } = makeClient({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Seu pedido está em separação.' }],
    })

    const adapter = new AnthropicLlmAdapter(client)
    const result  = await adapter.chat(PARAMS)

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model:      'claude-sonnet-5',
      max_tokens: 1024,
      system:     PARAMS.system,
      messages:   PARAMS.messages,
    }))
    expect(result).toEqual({
      stopReason: 'end_turn',
      content: [{ type: 'text', text: 'Seu pedido está em separação.' }],
    })
  })

  it('mapeia bloco tool_use e stop_reason tool_use', async () => {
    const { client } = makeClient({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'tu-1', name: 'read_protheus_pedido', input: { numeroPedido: 'PED-1' } }],
    })

    const adapter = new AnthropicLlmAdapter(client)
    const result  = await adapter.chat(PARAMS)

    expect(result).toEqual({
      stopReason: 'tool_use',
      content: [{ type: 'tool_use', id: 'tu-1', name: 'read_protheus_pedido', input: { numeroPedido: 'PED-1' } }],
    })
  })

  it('descarta blocos de tipo diferente de text/tool_use', async () => {
    const { client } = makeClient({
      stop_reason: 'max_tokens',
      content: [
        { type: 'text', text: 'parte 1' },
        { type: 'thinking', thinking: 'raciocínio interno' },
      ],
    })

    const adapter = new AnthropicLlmAdapter(client)
    const result  = await adapter.chat(PARAMS)

    expect(result.content).toEqual([{ type: 'text', text: 'parte 1' }])
    expect(result.stopReason).toBe('max_tokens')
  })
})
