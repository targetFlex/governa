import type { AutonomyLevel } from './autonomy-level'
import type { Tool } from './tool.types'

/**
 * ToolScope — contrato entregue ao orquestrador LLM.
 *
 * Restrição estrutural (não instrucional): as tools que o LLM PODE invocar
 * são exatamente as que estão neste array. Tudo o que não está aqui é
 * fisicamente inalcançável no contexto da inferência.
 *
 * Imutável por construção — todo campo é readonly para evitar mutação
 * acidental por adapters ou middlewares downstream.
 */
export interface ToolScope {
  readonly agentId:       string
  readonly tenantId:      string
  readonly autonomyLevel: AutonomyLevel
  readonly tools:         readonly Tool[]
  readonly policyId:      string
  readonly policyVersion: string
}
