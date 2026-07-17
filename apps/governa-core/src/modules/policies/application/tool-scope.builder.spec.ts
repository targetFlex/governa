import type { Tool } from '../domain/tool.types'

import { ToolScopeBuilder } from './tool-scope.builder'

/**
 * Helper de fixtures — tools sintéticas, sem efeito colateral.
 */
const t = (name: string, isWrite: boolean, source: Tool['source'] = 'native'): Tool => ({
  name,
  description: `fixture:${name}`,
  isWrite,
  source,
  execute: async () => undefined,
})

const CATALOG: readonly Tool[] = [
  t('read_protheus_pedido',    false),
  t('read_protheus_cliente',   false),
  t('read_politica_atendimento', false),
  t('write_protheus_pedido_nota',   true),
  t('write_protheus_pedido_status', true),
]

const baseParams = {
  agentId:       'agent-x',
  tenantId:      'tenant-x',
  policyId:      'policy-x',
  policyVersion: '1.0.0',
}

describe('ToolScopeBuilder', () => {
  let builder: ToolScopeBuilder

  beforeEach(() => {
    builder = new ToolScopeBuilder(CATALOG)
  })

  describe('Given an agent with autonomy CONSULTIVO', () => {
    it('When build is called Then returns only read_* tools', () => {
      const scope = builder.build({
        ...baseParams,
        autonomyLevel: 'CONSULTIVO',
        allowedActions: ['read_protheus_pedido'], // deve ser ignorado p/ CONSULTIVO
      })

      expect(scope.tools.map(x => x.name)).toEqual([
        'read_protheus_pedido',
        'read_protheus_cliente',
        'read_politica_atendimento',
      ])
      expect(scope.tools.every(x => !x.isWrite)).toBe(true)
    })
  })

  describe('Given an agent with autonomy ASSISTIDO', () => {
    it('When allowedActions has exact name Then includes only that tool', () => {
      const scope = builder.build({
        ...baseParams,
        autonomyLevel: 'ASSISTIDO',
        allowedActions: ['write_protheus_pedido_nota'],
      })

      expect(scope.tools.map(x => x.name)).toEqual(['write_protheus_pedido_nota'])
    })

    it('When allowedActions has a prefix Then includes matching tools', () => {
      const scope = builder.build({
        ...baseParams,
        autonomyLevel: 'ASSISTIDO',
        allowedActions: ['write_protheus_pedido'], // prefixo
      })

      expect(scope.tools.map(x => x.name).sort()).toEqual([
        'write_protheus_pedido_nota',
        'write_protheus_pedido_status',
      ])
    })
  })

  describe('Given an agent with autonomy AUTONOMO', () => {
    it('When allowedActions mixes read + write Then both are returned', () => {
      const scope = builder.build({
        ...baseParams,
        autonomyLevel: 'AUTONOMO',
        allowedActions: ['read_protheus_pedido', 'write_protheus_pedido_status'],
      })

      expect(scope.tools.map(x => x.name).sort()).toEqual([
        'read_protheus_pedido',
        'write_protheus_pedido_status',
      ])
    })
  })

  describe('Given an mcpCatalog is passed for the call', () => {
    it('When autonomy is CONSULTIVO Then mcpCatalog reads are merged with native reads', () => {
      const mcpTool = t('mcp__protheus-plus__read_faturas', false, 'mcp')

      const scope = builder.build({
        ...baseParams,
        autonomyLevel: 'CONSULTIVO',
        allowedActions: [],
        mcpCatalog: [mcpTool],
      })

      expect(scope.tools.map(x => x.name).sort()).toEqual([
        'mcp__protheus-plus__read_faturas',
        'read_politica_atendimento',
        'read_protheus_cliente',
        'read_protheus_pedido',
      ])
    })

    it('When autonomy is ASSISTIDO Then mcpCatalog tools are only included if in allowedActions', () => {
      const mcpTool = t('mcp__protheus-plus__write_fatura_baixa', true, 'mcp')

      const scope = builder.build({
        ...baseParams,
        autonomyLevel: 'ASSISTIDO',
        allowedActions: ['mcp__protheus-plus__write_fatura_baixa'],
        mcpCatalog: [mcpTool],
      })

      expect(scope.tools).toEqual([mcpTool])
    })

    it('When mcpCatalog is omitted Then behavior is unchanged (native catalog only)', () => {
      const scope = builder.build({
        ...baseParams,
        autonomyLevel: 'CONSULTIVO',
        allowedActions: [],
      })

      expect(scope.tools.every(x => x.source === 'native')).toBe(true)
    })
  })

  describe('Given a built ToolScope', () => {
    it('Then the scope object is frozen (immutable)', () => {
      const scope = builder.build({
        ...baseParams,
        autonomyLevel: 'CONSULTIVO',
        allowedActions: [],
      })

      expect(Object.isFrozen(scope)).toBe(true)
      expect(Object.isFrozen(scope.tools)).toBe(true)
    })

    it('Then policy metadata is propagated unchanged', () => {
      const scope = builder.build({
        ...baseParams,
        policyId:      'policy-abc',
        policyVersion: '2.5.1',
        autonomyLevel: 'CONSULTIVO',
        allowedActions: [],
      })

      expect(scope.policyId).toBe('policy-abc')
      expect(scope.policyVersion).toBe('2.5.1')
      expect(scope.agentId).toBe('agent-x')
      expect(scope.tenantId).toBe('tenant-x')
      expect(scope.autonomyLevel).toBe('CONSULTIVO')
    })
  })
})
