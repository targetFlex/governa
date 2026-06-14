import type { AgentEntity } from '../domain/agent.entity'
import type { PolicyConfig } from '../domain/policy.types'
import type { Tool } from '../domain/tool.types'

import { InMemoryAgentRepository } from '../../../../test/fixtures/in-memory-agent.repository'
import { PolicyEngine } from './policy.engine'
import {
  AgentNotFoundError,
  AgentWithoutPolicyError,
} from './policy.errors'
import { ToolScopeBuilder } from './tool-scope.builder'

const tool = (name: string, isWrite: boolean): Tool => ({
  name,
  description: `fixture:${name}`,
  isWrite,
  execute: async () => undefined,
})

const CATALOG: readonly Tool[] = [
  tool('read_protheus_pedido',  false),
  tool('read_protheus_cliente', false),
  tool('write_protheus_pedido', true),
]

const consultivoPolicy: PolicyConfig = {
  id:             'policy-consultivo',
  tenantId:       'tenant-1',
  name:           'Consultivo',
  autonomyLevel:  'CONSULTIVO',
  allowedActions: [],
  approvers:      [],
  version:        '1.0.0',
}

const assistidoPolicy: PolicyConfig = {
  id:             'policy-assistido',
  tenantId:       'tenant-1',
  name:           'Assistido',
  autonomyLevel:  'ASSISTIDO',
  allowedActions: ['write_protheus_pedido'],
  approvers:      ['user-approver-1'],
  version:        '1.0.0',
}

const agentConsultivo: AgentEntity = {
  id:       'agent-consultivo',
  tenantId: 'tenant-1',
  status:   'SANDBOX',
  policy:   consultivoPolicy,
}

const agentAssistido: AgentEntity = {
  id:       'agent-assistido',
  tenantId: 'tenant-1',
  status:   'ACTIVE',
  policy:   assistidoPolicy,
}

describe('PolicyEngine', () => {
  let repo: InMemoryAgentRepository
  let engine: PolicyEngine

  beforeEach(() => {
    repo   = new InMemoryAgentRepository()
    engine = new PolicyEngine(repo, new ToolScopeBuilder(CATALOG))
  })

  describe('Given a CONSULTIVO agent', () => {
    beforeEach(() => repo.add(agentConsultivo))

    it('When buildScope is called Then returns ToolScope with only read_* tools', async () => {
      const scope = await engine.buildScope('agent-consultivo', 'tenant-1')

      expect(scope.tools.every(t => !t.isWrite)).toBe(true)
      expect(scope.tools.map(t => t.name).sort()).toEqual([
        'read_protheus_cliente',
        'read_protheus_pedido',
      ])
      expect(scope.policyId).toBe('policy-consultivo')
      expect(scope.policyVersion).toBe('1.0.0')
      expect(scope.autonomyLevel).toBe('CONSULTIVO')
    })
  })

  describe('Given an ASSISTIDO agent', () => {
    beforeEach(() => repo.add(agentAssistido))

    it('When buildScope is called Then write_* tools matching allowedActions are present', async () => {
      const scope = await engine.buildScope('agent-assistido', 'tenant-1')

      const names = scope.tools.map(t => t.name)
      expect(names).toContain('write_protheus_pedido')
      expect(names.every(n => n.startsWith('write_'))).toBe(true)
    })
  })

  describe('Given a non-existent agent', () => {
    it('When buildScope is called Then throws AgentNotFoundError', async () => {
      await expect(engine.buildScope('does-not-exist', 'tenant-1'))
        .rejects.toBeInstanceOf(AgentNotFoundError)
    })

    it('Then the error message identifies agent + tenant', async () => {
      await expect(engine.buildScope('does-not-exist', 'tenant-1'))
        .rejects.toThrow('Agent does-not-exist not found for tenant tenant-1')
    })
  })

  describe('Given an agent without policy', () => {
    beforeEach(() => repo.add({
      ...agentConsultivo,
      id:     'agent-orphan',
      policy: null,
    }))

    it('When buildScope is called Then throws AgentWithoutPolicyError', async () => {
      await expect(engine.buildScope('agent-orphan', 'tenant-1'))
        .rejects.toBeInstanceOf(AgentWithoutPolicyError)
    })
  })

  describe('Given the engine is invoked', () => {
    it('Then the repository is always called with the provided tenantId', async () => {
      const spy = jest.spyOn(repo, 'findActiveForTenant')
      repo.add(agentConsultivo)

      await engine.buildScope('agent-consultivo', 'tenant-1')

      expect(spy).toHaveBeenCalledWith('agent-consultivo', 'tenant-1')
    })
  })
})
