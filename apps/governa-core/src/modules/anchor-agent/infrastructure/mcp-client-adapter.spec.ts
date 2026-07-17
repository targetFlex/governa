import { McpClientAdapter } from './mcp-client-adapter'
import type { McpServerRef } from '../../agents/domain/agent-inventory.entity'

const mockConnect  = jest.fn()
const mockClose    = jest.fn()
const mockListTools = jest.fn()
const mockCallTool  = jest.fn()

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect:   mockConnect,
    close:     mockClose,
    listTools: mockListTools,
    callTool:  mockCallTool,
  })),
}))

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest.fn().mockImplementation((url: URL, opts: unknown) => ({ url, opts })),
}))

const { Client }                        = jest.requireMock('@modelcontextprotocol/sdk/client/index.js') as { Client: jest.Mock }
const { StreamableHTTPClientTransport } = jest.requireMock('@modelcontextprotocol/sdk/client/streamableHttp.js') as { StreamableHTTPClientTransport: jest.Mock }

const SERVER: McpServerRef = {
  id:   'crm-1',
  name: 'CRM MCP',
  url:  'https://mcp.example.com/crm',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockConnect.mockResolvedValue(undefined)
})

describe('McpClientAdapter', () => {
  it('lança erro na construção se o conector não tem url', () => {
    expect(() => new McpClientAdapter({ id: 'x', name: 'Sem URL' })).toThrow(/não tem 'url'/)
  })

  describe('listTools', () => {
    it('conecta via StreamableHTTPClientTransport e mapeia tools com nome prefixado por serverId', async () => {
      mockListTools.mockResolvedValue({
        tools: [
          {
            name:        'buscar_lead',
            description: 'Busca lead por e-mail',
            inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
          },
        ],
      })

      const adapter = new McpClientAdapter(SERVER)
      const tools   = await adapter.listTools()

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
        new URL('https://mcp.example.com/crm'),
        { requestInit: undefined },
      )
      expect(mockConnect).toHaveBeenCalledTimes(1)
      expect(tools).toEqual([{
        name:        'mcp__crm-1__buscar_lead',
        description: 'Busca lead por e-mail',
        input_schema: {
          type:       'object',
          properties: { email: { type: 'string' } },
          required:   ['email'],
        },
      }])
    })

    it('propaga headers do conector como requestInit.headers', async () => {
      mockListTools.mockResolvedValue({ tools: [] })
      const adapter = new McpClientAdapter({ ...SERVER, headers: { Authorization: 'Bearer tok-1' } })

      await adapter.listTools()

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
        expect.any(URL),
        { requestInit: { headers: { Authorization: 'Bearer tok-1' } } },
      )
    })

    it('usa description vazia e properties/required vazios quando o servidor não os informa', async () => {
      mockListTools.mockResolvedValue({
        tools: [{ name: 'ping', inputSchema: { type: 'object' } }],
      })

      const adapter = new McpClientAdapter(SERVER)
      const tools   = await adapter.listTools()

      expect(tools).toEqual([{
        name:        'mcp__crm-1__ping',
        description: '',
        input_schema: { type: 'object', properties: {}, required: [] },
      }])
    })

    it('reutiliza a mesma conexão em chamadas subsequentes (connect uma única vez)', async () => {
      mockListTools.mockResolvedValue({ tools: [] })
      const adapter = new McpClientAdapter(SERVER)

      await adapter.listTools()
      await adapter.listTools()

      expect(Client).toHaveBeenCalledTimes(1)
      expect(mockConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('buildToolHandlers', () => {
    it('registra um ToolHandler por tool, chamando tools/call com name e arguments', async () => {
      mockListTools.mockResolvedValue({
        tools: [{ name: 'buscar_lead', description: 'x', inputSchema: { type: 'object' } }],
      })
      mockCallTool.mockResolvedValue({ content: [{ type: 'text', text: 'lead encontrado' }] })

      const adapter  = new McpClientAdapter(SERVER)
      const handlers = await adapter.buildToolHandlers()
      const handler  = handlers.get('mcp__crm-1__buscar_lead')!

      const output = await handler({
        tenantId: 't1', agentId: 'a1', subjectToken: 's1',
        params: { email: 'a@b.com' },
      })

      expect(mockCallTool).toHaveBeenCalledWith({ name: 'buscar_lead', arguments: { email: 'a@b.com' } })
      expect(output).toEqual([{ type: 'text', text: 'lead encontrado' }])
    })

    it('trata params ausente como objeto vazio de arguments', async () => {
      mockListTools.mockResolvedValue({ tools: [{ name: 'ping', inputSchema: { type: 'object' } }] })
      mockCallTool.mockResolvedValue({ content: [] })

      const adapter  = new McpClientAdapter(SERVER)
      const handlers = await adapter.buildToolHandlers()
      const handler  = handlers.get('mcp__crm-1__ping')!

      await handler({ tenantId: 't1', agentId: 'a1', subjectToken: 's1', params: undefined })

      expect(mockCallTool).toHaveBeenCalledWith({ name: 'ping', arguments: {} })
    })

    it('lança erro quando o resultado da tool vem com isError', async () => {
      mockListTools.mockResolvedValue({ tools: [{ name: 'buscar_lead', inputSchema: { type: 'object' } }] })
      mockCallTool.mockResolvedValue({ isError: true, content: [{ type: 'text', text: 'falha remota' }] })

      const adapter  = new McpClientAdapter(SERVER)
      const handlers = await adapter.buildToolHandlers()
      const handler  = handlers.get('mcp__crm-1__buscar_lead')!

      await expect(handler({ tenantId: 't1', agentId: 'a1', subjectToken: 's1', params: {} }))
        .rejects.toThrow(/tool 'buscar_lead'.*servidor 'crm-1'.*erro/)
    })
  })

  describe('close', () => {
    it('fecha a conexão e permite reconectar numa chamada seguinte', async () => {
      mockListTools.mockResolvedValue({ tools: [] })
      const adapter = new McpClientAdapter(SERVER)

      await adapter.listTools()
      await adapter.close()
      await adapter.listTools()

      expect(mockClose).toHaveBeenCalledTimes(1)
      expect(Client).toHaveBeenCalledTimes(2)
    })

    it('não lança quando close() é chamado sem conexão prévia', async () => {
      const adapter = new McpClientAdapter(SERVER)
      await expect(adapter.close()).resolves.toBeUndefined()
      expect(mockClose).not.toHaveBeenCalled()
    })
  })
})
