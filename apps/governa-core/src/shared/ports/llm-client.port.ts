/**
 * LlmClient — porta hexagonal para clientes LLM com suporte a tool_use.
 *
 * Isola o AnchorAgentService do SDK Anthropic concreto, permitindo:
 *   - Testes unitários com mocks simples
 *   - Troca de provedor LLM sem reescrever o serviço
 */

export interface LlmToolDef {
  readonly name:         string
  readonly description:  string
  readonly input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required:   string[]
  }
}

export type LlmTextBlock = {
  type: 'text'
  text: string
}

export type LlmToolUseBlock = {
  type:  'tool_use'
  id:    string
  name:  string
  input: unknown
}

export type LlmToolResultBlock = {
  type:        'tool_result'
  tool_use_id: string
  content:     string
}

export type LlmContentBlock = LlmTextBlock | LlmToolUseBlock | LlmToolResultBlock

export type LlmMessage = {
  role:    'user' | 'assistant'
  content: string | LlmContentBlock[]
}

export interface LlmChatResult {
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
  content:    LlmContentBlock[]
}

export interface LlmChatParams {
  system:    string
  messages:  LlmMessage[]
  tools:     LlmToolDef[]
  maxTokens: number
}

export interface LlmClient {
  chat(params: LlmChatParams): Promise<LlmChatResult>
}
