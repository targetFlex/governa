import { buildProtheusHandlers } from './protheus-tool-handlers'
import type { ConsultarPedidoUseCase } from '../../pedidos/application/consultar-pedido.use-case'
import type { ConsultarClienteUseCase } from '../../clientes/application/consultar-cliente.use-case'

const CTX_BASE = {
  tenantId:     'tenant-1',
  agentId:      'agent-1',
  subjectToken: 'subject-token-1',
}

describe('buildProtheusHandlers', () => {
  it('registra os handlers read_protheus_pedido e read_protheus_cliente', () => {
    const consultarPedido  = { execute: jest.fn() } as unknown as ConsultarPedidoUseCase
    const consultarCliente = { execute: jest.fn() } as unknown as ConsultarClienteUseCase

    const handlers = buildProtheusHandlers(consultarPedido, consultarCliente)

    expect(handlers.has('read_protheus_pedido')).toBe(true)
    expect(handlers.has('read_protheus_cliente')).toBe(true)
    expect(handlers.size).toBe(2)
  })

  describe('read_protheus_pedido', () => {
    it('propaga tenantId/agentId/subjectToken e filtros extraídos de params', async () => {
      const execute = jest.fn().mockResolvedValue({ pedidos: [] })
      const consultarPedido  = { execute } as unknown as ConsultarPedidoUseCase
      const consultarCliente = { execute: jest.fn() } as unknown as ConsultarClienteUseCase

      const handlers = buildProtheusHandlers(consultarPedido, consultarCliente)
      const handler  = handlers.get('read_protheus_pedido')!

      await handler({
        ...CTX_BASE,
        params: { numeroPedido: 'PED-1', clienteId: 'CLI-1', dataInicio: '20260101', dataFim: '20260131' },
      })

      expect(execute).toHaveBeenCalledWith({
        tenantId:     'tenant-1',
        agentId:      'agent-1',
        subjectToken: 'subject-token-1',
        filtros: {
          numeroPedido: 'PED-1',
          clienteId:    'CLI-1',
          dataInicio:   '20260101',
          dataFim:      '20260131',
        },
      })
    })

    it('trata params ausente (undefined) como objeto vazio', async () => {
      const execute = jest.fn().mockResolvedValue({ pedidos: [] })
      const consultarPedido  = { execute } as unknown as ConsultarPedidoUseCase
      const consultarCliente = { execute: jest.fn() } as unknown as ConsultarClienteUseCase

      const handlers = buildProtheusHandlers(consultarPedido, consultarCliente)
      const handler  = handlers.get('read_protheus_pedido')!

      await handler({ ...CTX_BASE, params: undefined })

      expect(execute).toHaveBeenCalledWith({
        tenantId:     'tenant-1',
        agentId:      'agent-1',
        subjectToken: 'subject-token-1',
        filtros: {
          numeroPedido: undefined,
          clienteId:    undefined,
          dataInicio:   undefined,
          dataFim:      undefined,
        },
      })
    })
  })

  describe('read_protheus_cliente', () => {
    it('propaga tenantId/agentId/subjectToken e filtros extraídos de params', async () => {
      const execute = jest.fn().mockResolvedValue({ clientes: [] })
      const consultarPedido  = { execute: jest.fn() } as unknown as ConsultarPedidoUseCase
      const consultarCliente = { execute } as unknown as ConsultarClienteUseCase

      const handlers = buildProtheusHandlers(consultarPedido, consultarCliente)
      const handler  = handlers.get('read_protheus_cliente')!

      await handler({
        ...CTX_BASE,
        params: { clienteId: 'CLI-1', documentoToken: 'hmac-doc-1' },
      })

      expect(execute).toHaveBeenCalledWith({
        tenantId:     'tenant-1',
        agentId:      'agent-1',
        subjectToken: 'subject-token-1',
        filtros: {
          clienteId:      'CLI-1',
          documentoToken: 'hmac-doc-1',
        },
      })
    })

    it('trata params ausente (null) como objeto vazio', async () => {
      const execute = jest.fn().mockResolvedValue({ clientes: [] })
      const consultarPedido  = { execute: jest.fn() } as unknown as ConsultarPedidoUseCase
      const consultarCliente = { execute } as unknown as ConsultarClienteUseCase

      const handlers = buildProtheusHandlers(consultarPedido, consultarCliente)
      const handler  = handlers.get('read_protheus_cliente')!

      await handler({ ...CTX_BASE, params: null })

      expect(execute).toHaveBeenCalledWith({
        tenantId:     'tenant-1',
        agentId:      'agent-1',
        subjectToken: 'subject-token-1',
        filtros: {
          clienteId:      undefined,
          documentoToken: undefined,
        },
      })
    })
  })
})
