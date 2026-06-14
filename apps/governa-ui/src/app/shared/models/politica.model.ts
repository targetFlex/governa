// ============================================================
// politica.model.ts
//
// Tipagem do domínio Política conforme contrato GET /policies/:id
// do governa-core (PolicyConfig).
//
// AutonomyLevel:
//   CONSULTIVO → agente só lê dados (somente read_*)
//   ASSISTIDO  → agente propõe ações, gestor aprova via PendingAction
//   AUTONOMO   → agente age diretamente dentro dos limites configurados
// ============================================================

export type AutonomyLevel = 'CONSULTIVO' | 'ASSISTIDO' | 'AUTONOMO';

export interface Politica {
  id:             string;
  tenantId:       string;
  name:           string;
  autonomyLevel:  AutonomyLevel;
  allowedActions: string[];
  maxValueBrl?:   number;         // limite por operação (ASSISTIDO / AUTONOMO)
  timeWindowH?:   number;         // janela de ação em horas (ASSISTIDO / AUTONOMO)
  approvers:      string[];       // e-mails dos aprovadores (ASSISTIDO)
  version:        string;         // semver, bump a cada save
}

export interface PoliticaResponse {
  data: Politica;
}

export interface PoliticasResponse {
  data:  Politica[];
  total: number;
}

/** Payload para PATCH /policies/:id */
export interface UpdatePoliticaDto {
  name?:           string;
  autonomyLevel?:  AutonomyLevel;
  allowedActions?: string[];
  maxValueBrl?:    number | null;
  timeWindowH?:    number | null;
  approvers?:      string[];
}
