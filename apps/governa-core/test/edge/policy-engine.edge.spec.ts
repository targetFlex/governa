import type { AgentEntity } from '../../src/modules/policies/domain/agent.entity'
import type { PolicyConfig } from '../../src/modules/policies/domain/policy.types'
import type { Tool } from '../../src/modules/policies/domain/tool.types'

import {
  AgentNotFoundError,
  AgentWithoutPolicyError,
} from '../../src/modules/policies/application/policy.errors'
import { PolicyEngine } from '../../src/modules/policies/application/policy.engine'
import { ToolScopeBuilder } from '../../src/modules/policies/application/tool-scope.builder'
import { InMemoryAgentRepository } from '../fixtures/in-memory-agent.repository'

/**
 * Edge cases obrigatórios — E1 sessão 1.2, linhas 253-263.
 * Mantidos isolados em test/edge/ por preferência #5 do usuário
 * (edge cases separados da suite unitária principal).
 */

const t = (name: string, isWrite: boolean): Tool => ({
  name, description: name, isWrite, execute: async () => undefined,
})

const CATALOG: readonly Tool[] = [
  t('read_protheus_pedido',         false),
  t('read_protheus_cliente',        false),
  t('write_protheus_pedido_nota',   true),
  t('write_protheus_pedido_status', true),
]

const policyConsultivo: PolicyConfig = {
  id: 'p1', tenantId: 'tenant-A', name: 'p',
  autonomyLevel: 'CONSULTIVO',
  allowedActions: [],
  approvers: [], version: '1.0.0',
}

const policyAutonomo = (allowed: string[]): PolicyConfig => ({
  id: 'p-auto', tenantId: 'tenant-A', name: 'auto',
  autonomyLevel: 'AUTONOMO',
  allowedActions: allowed,
  approvers: [], version: '1.0.0',
})

function setup() {
  const repo   = new InMemoryAgentRepository()
  const engine = new PolicyEngine(repo, new ToolScopeBuilder(CATALOG))
  return { repo, engine }
}

describe('PolicyEngine — edge cases', () => {
  it('Edge: agente DEPRECATED não deve retornar ToolScope', async () => {
    const { repo, engine } = setup()
    const deprecated: AgentEntity = {
      id: 'a-dep', tenantId: 'tenant-A', status: 'DEPRECATED',
      policy: policyConsultivo,
    }
    repo.add(deprecated)

    await expect(engine.buildScope('a-dep', 'tenant-A'))
      .rejects.toBeInstanceOf(AgentNotFoundError)
  })

  it('Edge: agente sem política atribuída deve lançar erro descritivo', async () => {
    const { repo, engine } = setup()
    repo.add({
      id: 'a-orphan', tenantId: 'tenant-A', status: 'ACTIVE',
      policy: null,
    })

    await expect(engine.buildScope('a-orphan', 'tenant-A'))
      .rejects.toThrow(AgentWithoutPolicyError)
    await expect(engine.buildScope('a-orphan', 'tenant-A'))
      .rejects.toThrow('Agent a-orphan has no active policy')
  })

  it('Edge: agente de tenant A não deve ser acessível por tenant B', async () => {
    const { repo, engine } = setup()
    repo.add({
      id: 'a-cross', tenantId: 'tenant-A', status: 'ACTIVE',
      policy: policyConsultivo,
    })

    await expect(engine.buildScope('a-cross', 'tenant-B'))
      .rejects.toBeInstanceOf(AgentNotFoundError)
  })

  it('Edge: allowedActions vazio em AUTONOMO deve retornar ToolScope vazio', async () => {
    const { repo, engine } = setup()
    repo.add({
      id: 'a-auto-empty', tenantId: 'tenant-A', status: 'ACTIVE',
      policy: policyAutonomo([]),
    })

    const scope = await engine.buildScope('a-auto-empty', 'tenant-A')
    expect(scope.tools).toEqual([])
    expect(scope.autonomyLevel).toBe('AUTONOMO')
  })

  it('Edge: tool com nome exato e tool com prefixo devem ambas ser incluídas', async () => {
    const { repo, engine } = setup()
    repo.add({
      id: 'a-mixed', tenantId: 'tenant-A', status: 'ACTIVE',
      // exata: read_protheus_cliente
      // prefixo: write_protheus_pedido (pega _nota e _status)
      policy: policyAutonomo(['read_protheus_cliente', 'write_protheus_pedido']),
    })

    const scope = await engine.buildScope('a-mixed', 'tenant-A')
    const names = scope.tools.map(x => x.name).sort()

    expect(names).toEqual([
      'read_protheus_cliente',
      'write_protheus_pedido_nota',
      'write_protheus_pedido_status',
    ])
  })
})
