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
  createdAt:    string;   // ISO 8601
  updatedAt:    string;   // ISO 8601
  lastActiveAt: string | null; // ISO 8601
}

export interface AgentesResponse {
  data:  Agente[];
  total: number;
}
