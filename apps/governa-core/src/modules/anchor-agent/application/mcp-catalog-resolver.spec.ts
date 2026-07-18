import type { McpServerRef } from '../../agents/domain/agent-inventory.entity'
import type { LlmToolDef }   from '../../../shared/ports/llm-client.port'
import type { ToolHandler }  from './protheus-tool-handlers'

const mockListTools         = jest.fn()
const mockBuildToolHandlers = jest.fn()

jest.mock('../infrastructure/mcp-client-adapter', () => ({
  McpClientAdapter: jest.fn().mockImplementation((server: McpServerRef) => ({
    listTools:         () => mockListTools(server),
    buildToolHandlers: () => mockBuildToolHandlers(server),
  })),
}))

import { resolveMcpCatalog, EMPTY_MCP_CATALOG } from './mcp-catalog-resolver'
import { McpClientAdapter } from '../infrastructure/mcp-client-adapter'

const SERVER_A: McpServerRef = { id: 'crm-1', name: 'CRM', url: 'https://mcp.example.com/crm' }
const SERVER_B: McpServerRef = { id: 'erp-2', name: 'ERP externo', url: 'https://mcp.example.com/erp' }
const SERVER_SEM_URL: McpServerRef = { id: 'sem-url', name: 'Descritivo apenas' }

function defs(...names: string[]): LlmToolDef[] {
  return names.map(name => ({
    name,
    description: `desc:${name}`,
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  }))
}

function handlerMap(...names: string[]): Map<string, ToolHandler> {
  return new Map(names.map(name => [name, jest.fn().mockResolvedValue({ ok: true })]))
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('resolveMcpCatalog', () => {
  it('retorna EMPTY_MCP_CATALOG quando não há conectores', async () => {
    const catalog = await resolveMcpCatalog([])
    expect(catalog).toBe(EMPTY_MCP_CATALOG)
    expect(McpClientAdapter).not.toHaveBeenCalled()
  })

  it('ignora conectores sem url (metadado descritivo) e não tenta conectar', async () => {
    const catalog = await resolveMcpCatalog([SERVER_SEM_URL])
    expect(catalog).toBe(EMPTY_MCP_CATALOG)
    expect(McpClientAdapter).not.toHaveBeenCalled()
  })

  it('resolve toolDefs, policyTools e handlers de um conector válido', async () => {
    mockListTools.mockResolvedValue(defs('mcp__crm-1__buscar_lead'))
    mockBuildToolHandlers.mockResolvedValue(handlerMap('mcp__crm-1__buscar_lead'))

    const catalog = await resolveMcpCatalog([SERVER_A])

    expect(catalog.toolDefs).toHaveLength(1)
    expect(catalog.toolDefs[0]!.name).toBe('mcp__crm-1__buscar_lead')

    expect(catalog.policyTools).toEqual([{
      name:        'mcp__crm-1__buscar_lead',
      description: 'desc:mcp__crm-1__buscar_lead',
      isWrite:     true,
      source:      'mcp',
      serverId:    'crm-1',
      execute:     expect.any(Function),
    }])

    expect(catalog.handlers.has('mcp__crm-1__buscar_lead')).toBe(true)
  })

  it('marca isWrite: true mesmo que o nome da tool sugira leitura (fronteira MCP não confiável)', async () => {
    mockListTools.mockResolvedValue(defs('mcp__crm-1__read_lead'))
    mockBuildToolHandlers.mockResolvedValue(handlerMap('mcp__crm-1__read_lead'))

    const catalog = await resolveMcpCatalog([SERVER_A])

    expect(catalog.policyTools[0]!.isWrite).toBe(true)
  })

  it('mescla catálogo de múltiplos conectores preservando o serverId de cada tool', async () => {
    mockListTools.mockImplementation((server: McpServerRef) =>
      server.id === 'crm-1' ? defs('mcp__crm-1__buscar_lead') : defs('mcp__erp-2__consultar_estoque'),
    )
    mockBuildToolHandlers.mockImplementation((server: McpServerRef) =>
      server.id === 'crm-1' ? handlerMap('mcp__crm-1__buscar_lead') : handlerMap('mcp__erp-2__consultar_estoque'),
    )

    const catalog = await resolveMcpCatalog([SERVER_A, SERVER_B])

    expect(catalog.policyTools.map(t => t.serverId).sort()).toEqual(['crm-1', 'erp-2'])
    expect(catalog.handlers.has('mcp__crm-1__buscar_lead')).toBe(true)
    expect(catalog.handlers.has('mcp__erp-2__consultar_estoque')).toBe(true)
  })

  it('best-effort: falha de conexão em um conector não derruba os demais', async () => {
    mockListTools.mockImplementation((server: McpServerRef) => {
      if (server.id === 'crm-1') return Promise.reject(new Error('conexão recusada'))
      return Promise.resolve(defs('mcp__erp-2__consultar_estoque'))
    })
    mockBuildToolHandlers.mockImplementation((server: McpServerRef) => {
      if (server.id === 'crm-1') return Promise.reject(new Error('conexão recusada'))
      return Promise.resolve(handlerMap('mcp__erp-2__consultar_estoque'))
    })

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const catalog = await resolveMcpCatalog([SERVER_A, SERVER_B])
    consoleErrorSpy.mockRestore()

    expect(catalog.policyTools).toHaveLength(1)
    expect(catalog.policyTools[0]!.serverId).toBe('erp-2')
  })
})
