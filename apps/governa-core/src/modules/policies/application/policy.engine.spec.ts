import type { AgentEntity } from '../domain/agent.entity'
import type { PolicyConfig } from '../domain/policy.types'
import type { Tool } from '../domain/tool.types'

import { InMemoryAgentRepository } from '../../../../test/fixtures/in-memory-agent.repository'
import { PolicyEngine } from './policy.engine'
import {
  AgentNotFoundError,
  AgentWithoutPolicyError,
  ToolBlockedError,
} from './policy.errors'
import { ToolScopeBuilder } from './tool-scope.builder'
import type { PolicyViolationAlertService } from '../../alerts/application/policy-violation-alert.service'

const tool = (name: string, isWrite: boolean): Tool => ({
  name,
  description: `fixture:${name}`,
  isWrite,
  source: 'native',
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

function makeMockAlertSvc(): PolicyViolationAlertService {
  return {
    evaluate: jest.fn(() => Promise.resolve([])),
  } as unknown as PolicyViolationAlertService
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

  // ── D34, sessão 2.81: mcpCatalog repassado ao ToolScopeBuilder ─────────────

  describe('Given mcpCatalog is passed to buildScope', () => {
    beforeEach(() => repo.add(agentConsultivo))

    it('When agent is CONSULTIVO, Then MCP tools are merged and filtered like native tools', async () => {
      const mcpTool = tool('mcp__crm-1__read_lead', false)
      const scope = await engine.buildScope('agent-consultivo', 'tenant-1', [mcpTool])

      expect(scope.tools.map(t => t.name)).toContain('mcp__crm-1__read_lead')
    })

    it('When mcpCatalog is omitted, Then behaves exactly as before (native catalog only)', async () => {
      const scope = await engine.buildScope('agent-consultivo', 'tenant-1')

      expect(scope.tools.map(t => t.name).sort()).toEqual([
        'read_protheus_cliente',
        'read_protheus_pedido',
      ])
    })
  })

  // ── E5.3: assertToolAllowed ───────────────────────────────────────────────

  describe('E5.3 — assertToolAllowed', () => {
    describe('Given a CONSULTIVO agent scope', () => {
      it('When tool is in scope, Then resolves without error or alert', async () => {
        repo.add(agentConsultivo)
        const alertSvc = makeMockAlertSvc()
        const engineWithAlert = new PolicyEngine(repo, new ToolScopeBuilder(CATALOG), alertSvc)
        const scope = await engineWithAlert.buildScope('agent-consultivo', 'tenant-1')

        await expect(engineWithAlert.assertToolAllowed(scope, 'read_protheus_pedido'))
          .resolves.toBeUndefined()

        await Promise.resolve()
        expect(alertSvc.evaluate).not.toHaveBeenCalled()
      })

      it('When tool is NOT in scope, Then throws ToolBlockedError', async () => {
        repo.add(agentConsultivo)
        const scope = await engine.buildScope('agent-consultivo', 'tenant-1')

        await expect(engine.assertToolAllowed(scope, 'write_protheus_pedido'))
          .rejects.toBeInstanceOf(ToolBlockedError)
      })

      it('When tool is NOT in scope, Then ToolBlockedError carries toolName and policyId', async () => {
        repo.add(agentConsultivo)
        const scope = await engine.buildScope('agent-consultivo', 'tenant-1')

        const err = await engine.assertToolAllowed(scope, 'write_protheus_pedido').catch(e => e)
        expect(err).toBeInstanceOf(ToolBlockedError)
        expect((err as ToolBlockedError).toolName).toBe('write_protheus_pedido')
        expect((err as ToolBlockedError).policyId).toBe('policy-consultivo')
        expect((err as ToolBlockedError).code).toBe('TOOL_BLOCKED')
      })

      it('When tool is NOT in scope, Then evaluate() is called with TOOL_BLOCKED event', async () => {
        repo.add(agentConsultivo)
        const alertSvc = makeMockAlertSvc()
        const engineWithAlert = new PolicyEngine(repo, new ToolScopeBuilder(CATALOG), alertSvc)
        const scope = await engineWithAlert.buildScope('agent-consultivo', 'tenant-1')

        await engineWithAlert.assertToolAllowed(scope, 'write_protheus_pedido').catch(() => {})
        await Promise.resolve()

        expect(alertSvc.evaluate).toHaveBeenCalledTimes(1)
        expect(alertSvc.evaluate).toHaveBeenCalledWith(
          expect.objectContaining({
            kind:     'TOOL_BLOCKED',
            tenantId: 'tenant-1',
            agentId:  'agent-consultivo',
            toolName: 'write_protheus_pedido',
            policyId: 'policy-consultivo',
          }),
        )
      })
    })

    describe('Given no policyViolationAlertSvc injected', () => {
      it('When tool is NOT in scope, Then still throws ToolBlockedError (alert svc optional)', async () => {
        repo.add(agentConsultivo)
        const scope = await engine.buildScope('agent-consultivo', 'tenant-1')

        await expect(engine.assertToolAllowed(scope, 'write_protheus_pedido'))
          .rejects.toBeInstanceOf(ToolBlockedError)
      })
    })

    describe('Given evaluate() rejects', () => {
      it('When alertSvc.evaluate rejects, Then ToolBlockedError is still thrown (best-effort)', async () => {
        repo.add(agentConsultivo)
        const alertSvc = {
          evaluate: jest.fn(() => Promise.reject(new Error('alert down'))),
        } as unknown as PolicyViolationAlertService
        const engineWithAlert = new PolicyEngine(repo, new ToolScopeBuilder(CATALOG), alertSvc)
        const scope = await engineWithAlert.buildScope('agent-consultivo', 'tenant-1')

        await expect(engineWithAlert.assertToolAllowed(scope, 'write_protheus_pedido'))
          .rejects.toBeInstanceOf(ToolBlockedError)

        await Promise.resolve()
        // não deve relançar o erro do evaluate
      })
    })
  })
})
