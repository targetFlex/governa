import type { AutonomyLevel } from './autonomy-level'

/**
 * PolicyConfig — política de governança aplicada a um agente.
 *
 * Mapeia 1:1 para o modelo Prisma `Policy`, mas mantida aqui como tipo
 * de domínio puro para que PolicyEngine e ToolScopeBuilder não importem
 * de @prisma/client.
 *
 * `allowedActions` aceita nome exato (`read_protheus_pedido`) ou prefixo
 * (`read_protheus_*` → `read_protheus`) — a regra de match está no
 * ToolScopeBuilder.filterTools.
 */
export interface PolicyConfig {
  readonly id:             string
  readonly tenantId:       string
  readonly name:           string
  readonly autonomyLevel:  AutonomyLevel
  readonly allowedActions: readonly string[]
  readonly maxValueBrl?:   number
  readonly timeWindowH?:   number
  readonly approvers:      readonly string[]
  readonly version:        string
}
