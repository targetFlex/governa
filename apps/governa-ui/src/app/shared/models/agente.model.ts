// ============================================================
// agente.model.ts
//
// Tipagem do domínio Agente conforme contrato GET /agents
// do governa-core (AgentInventoryEntity).
//
// AgentStatus replica o enum Prisma do backend:
//   SANDBOX    → criado, ainda não ativado para produção
//   ACTIVE     → em execução (produção ou staging)
//   PAUSED     → suspenso manualmente (pode ser reativado)
//   DEPRECATED → estado terminal, sem ações disponíveis
// ============================================================

export type AgentStatus = 'SANDBOX' | 'ACTIVE' | 'PAUSED' | 'DEPRECATED';

/**
 * Referência a um conector MCP habilitado no agente.
 * Nesta fase (E8) é apenas metadado descritivo — sem integração funcional.
 * `icon` é opcional (slug/chave de ícone para o frontend).
 */
export interface McpServerRef {
  id:    string;
  name:  string;
  icon?: string;
}

export interface Agente {
  id:           string;
  tenantId:     string;
  name:         string;
  description:  string;
  ownerId:      string;
  policyId:     string | null;
  status:       AgentStatus;
  modelId:      string;
  tools:        string[];
  systemPrompt: string | null;
  mcpServers:   McpServerRef[];
  skills:       string[];
  templateId:   string | null;
  createdAt:    string;   // ISO 8601
  updatedAt:    string;   // ISO 8601
  lastActiveAt: string | null; // ISO 8601
}

export interface AgentesResponse {
  data:  Agente[];
  total: number;
}

export interface CreateAgenteDto {
  name:          string;
  description?:  string;
  ownerId:       string;
  policyId?:     string | null;
  modelId:       string;
  tools?:        string[];
  systemPrompt?: string;
  mcpServers?:   McpServerRef[];
  skills?:       string[];
  templateId?:   string;
}

export interface UpdateAgenteDto {
  name?:        string;
  description?: string;
  modelId?:     string;
  tools?:       string[];
  policyId?:    string | null;
}
