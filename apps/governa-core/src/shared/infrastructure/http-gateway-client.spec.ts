/**
 * http-gateway-client.spec.ts — Sessão 2.15
 *
 * Testes de integração do HttpGatewayClient usando servidor Express in-process
 * (padrão estabelecido em agent.router.spec.ts / sessões 2.7–2.8).
 *
 * Estratégia:
 *   - Cria Express real em porta aleatória que simula governa-gateway
 *   - HttpGatewayClient faz fetch para http://localhost:{porta}
 *   - Verifica mapeamento de resposta, propagação de query params e erros
 *
 * Casos (HG-1 a HG-10):
 *   HG-1  consultarPedidos happy path — retorna PedidoInterno[]
 *   HG-2  dataEmissao string → Date convertida
 *   HG-3  itens mapeados corretamente
 *   HG-4  consultarPedidos array vazio → []
 *   HG-5  filtro numeroPedido propagado na querystring
 *   HG-6  filtro clienteId + dataInicio + dataFim propagados
 *   HG-7  gateway 500 → GatewayUnavailableError
 *   HG-8  rede indisponível (porta fechada) → GatewayUnavailableError
 *   HG-9  consultarClientes happy path — retorna ClienteInterno[]
 *   HG-10 filtro documentoToken propagado na querystring
 */

import http   from 'http'
import express from 'express'
import type { Request, Response } from 'express'

import { HttpGatewayClient }    from './http-gateway-client'
import { GatewayUnavailableError } from '../../modules/pedidos/domain/pedido.errors'
import type { PedidoInterno }   from '../../modules/pedidos/domain/pedido.entity'
import type { ClienteInterno }  from '../../modules/clientes/domain/cliente.entity'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RAW_PEDIDO = {
  numeroPedido:  'PED-001',
  clienteId:     'CLI-001',
  loja:          '01',
  dataEmissao:   '2024-03-15T00:00:00.000Z',
  valorTotal:    1500.00,
  status:        'ABERTO' as const,
  itens: [
    { codigoProduto: 'PROD-A', quantidade: 2, precoUnitario: 750.00 },
  ],
}

const RAW_CLIENTE: ClienteInterno = {
  clienteId:      'CLI-001',
  loja:           '01',
  nomeToken:      'hmac-nome-abc',
  documentoToken: 'hmac-doc-xyz',
  enderecoToken:  'hmac-end-def',
  emailToken:     null,
  telefoneToken:  null,
  bloqueado:      false,
}

// ─── Setup do servidor mock ───────────────────────────────────────────────────

let server:  http.Server
let baseUrl: string

/** Controles do mock — modificados por cada teste que precisar */
let mockPedidosResponse: { status: number; body: unknown } = { status: 200, body: [RAW_PEDIDO] }
let mockClientesResponse: { status: number; body: unknown } = { status: 200, body: [RAW_CLIENTE] }

/** Query params capturados pela última chamada */
let lastPedidosQuery:  Record<string, string> = {}
let lastClientesQuery: Record<string, string> = {}

beforeEach(() => new Promise<void>(resolve => {
  mockPedidosResponse  = { status: 200, body: [RAW_PEDIDO] }
  mockClientesResponse = { status: 200, body: [RAW_CLIENTE] }
  lastPedidosQuery     = {}
  lastClientesQuery    = {}

  const app = express()

  app.get('/pedidos', (req: Request, res: Response) => {
    lastPedidosQuery = req.query as Record<string, string>
    res.status(mockPedidosResponse.status).json(mockPedidosResponse.body)
  })

  app.get('/clientes', (req: Request, res: Response) => {
    lastClientesQuery = req.query as Record<string, string>
    res.status(mockClientesResponse.status).json(mockClientesResponse.body)
  })

  server = http.createServer(app)
  server.listen(0, () => {
    const addr = server.address() as { port: number }
    baseUrl = `http://localhost:${addr.port}`
    resolve()
  })
}))

afterEach(() => new Promise<void>(resolve => {
  server.close(() => resolve())
}))

// ─── consultarPedidos ─────────────────────────────────────────────────────────

describe('HttpGatewayClient — consultarPedidos', () => {
  it('HG-1: happy path — retorna PedidoInterno[] com campos corretos', async () => {
    const client  = new HttpGatewayClient(baseUrl)
    const pedidos = await client.consultarPedidos({})

    expect(pedidos).toHaveLength(1)
    const p = pedidos[0] as PedidoInterno
    expect(p.numeroPedido).toBe('PED-001')
    expect(p.clienteId).toBe('CLI-001')
    expect(p.status).toBe('ABERTO')
    expect(p.valorTotal).toBe(1500.00)
  })

  it('HG-2: dataEmissao string → Date', async () => {
    const client  = new HttpGatewayClient(baseUrl)
    const pedidos = await client.consultarPedidos({})

    const p = pedidos[0] as PedidoInterno
    expect(p.dataEmissao).toBeInstanceOf(Date)
    expect(p.dataEmissao.toISOString()).toBe(RAW_PEDIDO.dataEmissao)
  })

  it('HG-3: itens mapeados — codigoProduto, quantidade, precoUnitario', async () => {
    const client  = new HttpGatewayClient(baseUrl)
    const pedidos = await client.consultarPedidos({})

    const item = (pedidos[0] as PedidoInterno).itens[0]
    expect(item).toEqual({ codigoProduto: 'PROD-A', quantidade: 2, precoUnitario: 750.00 })
  })

  it('HG-4: array vazio → []', async () => {
    mockPedidosResponse = { status: 200, body: [] }

    const client  = new HttpGatewayClient(baseUrl)
    const pedidos = await client.consultarPedidos({})

    expect(pedidos).toEqual([])
  })

  it('HG-5: filtro numeroPedido propagado na querystring', async () => {
    const client = new HttpGatewayClient(baseUrl)
    await client.consultarPedidos({ numeroPedido: 'PED-999' })

    expect(lastPedidosQuery['numeroPedido']).toBe('PED-999')
  })

  it('HG-6: filtros clienteId + dataInicio + dataFim propagados', async () => {
    const client = new HttpGatewayClient(baseUrl)
    await client.consultarPedidos({
      clienteId:  'CLI-XYZ',
      dataInicio: '20240101',
      dataFim:    '20240131',
    })

    expect(lastPedidosQuery['clienteId']).toBe('CLI-XYZ')
    expect(lastPedidosQuery['dataInicio']).toBe('20240101')
    expect(lastPedidosQuery['dataFim']).toBe('20240131')
  })

  it('HG-7: gateway 500 → GatewayUnavailableError', async () => {
    mockPedidosResponse = { status: 500, body: { error: 'internal' } }

    const client = new HttpGatewayClient(baseUrl)
    await expect(client.consultarPedidos({})).rejects.toThrow(GatewayUnavailableError)
  })

  it('HG-8: rede indisponível (porta fechada) → GatewayUnavailableError', async () => {
    // Aponta para porta que não existe
    const client = new HttpGatewayClient('http://localhost:1')
    await expect(client.consultarPedidos({})).rejects.toThrow(GatewayUnavailableError)
  })
})

// ─── consultarClientes ────────────────────────────────────────────────────────

describe('HttpGatewayClient — consultarClientes', () => {
  it('HG-9: happy path — retorna ClienteInterno[]', async () => {
    const client   = new HttpGatewayClient(baseUrl)
    const clientes = await client.consultarClientes({})

    expect(clientes).toHaveLength(1)
    const c = clientes[0] as ClienteInterno
    expect(c.clienteId).toBe('CLI-001')
    expect(c.nomeToken).toBe('hmac-nome-abc')
    expect(c.bloqueado).toBe(false)
  })

  it('HG-10: filtro documentoToken propagado na querystring', async () => {
    const client = new HttpGatewayClient(baseUrl)
    await client.consultarClientes({ documentoToken: 'hmac-doc-xyz' })

    expect(lastClientesQuery['documentoToken']).toBe('hmac-doc-xyz')
  })
})
