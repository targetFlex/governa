// ============================================================
// policy.service.ts
//
// Application service para gerenciamento de políticas.
//
// Responsabilidades (SRP):
//   - Recuperar política por id (com isolamento de tenant)
//   - Listar políticas do tenant
//   - Atualizar política (persiste nova versão via bump automático)
//
// Não contém lógica de PolicyEngine (buildScope) — esse permanece
// em policy.engine.ts, separado por SRP.
// ============================================================

import type { PolicyRepository, UpdatePolicyInput } from '../infrastructure/prisma-policy.repository'
import type { PolicyConfig }                         from '../domain/policy.types'

export class PolicyNotFoundError extends Error {
  readonly code = 'POLICY_NOT_FOUND'
  constructor(id: string) {
    super(`Política ${id} não encontrada ou inativa`)
    this.name = 'PolicyNotFoundError'
  }
}

export class PolicyService {
  constructor(private readonly repo: PolicyRepository) {}

  /** Retorna política ativa do tenant ou lança PolicyNotFoundError */
  async getPolicy(id: string, tenantId: string): Promise<PolicyConfig> {
    const policy = await this.repo.findByIdForTenant(id, tenantId)
    if (!policy) throw new PolicyNotFoundError(id)
    return policy
  }

  /** Lista todas as políticas ativas do tenant */
  async listPolicies(tenantId: string): Promise<PolicyConfig[]> {
    return this.repo.findAllForTenant(tenantId)
  }

  /** Atualiza política e retorna a versão atualizada */
  async updatePolicy(
    id:       string,
    tenantId: string,
    data:     UpdatePolicyInput,
  ): Promise<PolicyConfig> {
    const updated = await this.repo.update(id, tenantId, data)
    if (!updated) throw new PolicyNotFoundError(id)
    return updated
  }
}
