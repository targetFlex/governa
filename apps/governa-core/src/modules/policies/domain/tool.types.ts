/**
 * Tool — capacidade discreta que um agente pode invocar.
 *
 * `isWrite` é a chave da governança: classifica a tool como leitura (false)
 * ou mutação (true). O ToolScopeBuilder usa isso para aplicar o nível de
 * autonomia. Convenção de nomes:
 *   - read_*   → consultas (isWrite = false)
 *   - write_*  → mutações (isWrite = true)
 */
export interface Tool {
  readonly name:        string
  readonly description: string
  readonly isWrite:     boolean
  /**
   * Stub para o MVP — sessão 1.2 não invoca tools de verdade.
   * Sessão 2 (integração Protheus) substitui pelos handlers reais.
   */
  readonly execute:     (params: unknown) => Promise<unknown>
}
