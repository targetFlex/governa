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
 *   HG-4  consultarPedidos — gateway 404 (nenhum resultado) → []
 *   HG-5  filtro numeroPedido propagado na querystring
 *   HG-6  filtro clienteId + dataInicio + dataFim propagados
 *   HG-7  gateway 500 → GatewayUnavailableError
 *   HG-8  rede indisponível (porta fechada) → GatewayUnavailableError
 *   HG-9  consultarClientes happy path — retorna ClienteInterno[]
 *   HG-10 filtro documentoToken propagado na querystring
 *   HG-11 reidentificarCliente happy path — retorna ClientePiiView traduzido
 *   HG-12 reidentificarCliente — gateway 404 → null
 *   HG-13 reidentificarCliente — clienteId/loja propagados como codigoCliente/loja
 *   HG-14 reidentificarCliente — gateway 500 → GatewayUnavailableError
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

// Shape real da wire do governa-gateway (contrato Pact CC3/CC4) —
// nomenclatura diferente do domínio do core (ver mapCliente em http-gateway-client.ts).
const RAW_CLIENTE = {
  codigoCliente:   'CLI-001',
  loja:            '01',
  nomePseudo:      'hmac-nome-abc',
  documentoPseudo: 'hmac-doc-xyz',
  enderecoPseudo:  'hmac-end-def',
  emailPseudo:     null,
  telefonePseudo:  null,
  ativo:           true,
}

const RAW_CLIENTE_PII = {
  codigoCliente: 'CLI-001',
  loja:          '01',
  nome:          'Empresa Exemplo LTDA',
  documento:     '12.345.678/0001-90',
  email:         'contato@exemplo.com',
  telefone:      '(11) 4000-0000',
  endereco:      'Rua Exemplo, 1|São Paulo|SP|01000000',
}

// ─── Setup do servidor mock ───────────────────────────────────────────────────

let server:  http.Server
let baseUrl: string

/** Controles do mock — modificados por cada teste que precisar.
 *  Contrato real do governa-gateway: envelope { data: [...] } em 200,
 *  { code: 'NOT_FOUND', message } em 404 quando a lista é vazia. */
let mockPedidosResponse: { status: number; body: unknown } = { status: 200, body: { data: [RAW_PEDIDO] } }
let mockClientesResponse: { status: number; body: unknown } = { status: 200, body: { data: [RAW_CLIENTE] } }
let mockClientePiiResponse: { status: number; body: unknown } = { status: 200, body: { data: RAW_CLIENTE_PII } }

/** Query params capturados pela última chamada */
let lastPedidosQuery:     Record<string, string> = {}
let lastClientesQuery:    Record<string, string> = {}
let lastClientePiiQuery:  Record<string, string> = {}

beforeEach(() => new Promise<void>(resolve => {
  mockPedidosResponse    = { status: 200, body: { data: [RAW_PEDIDO] } }
  mockClientesResponse   = { status: 200, body: { data: [RAW_CLIENTE] } }
  mockClientePiiResponse = { status: 200, body: { data: RAW_CLIENTE_PII } }
  lastPedidosQuery       = {}
  lastClientesQuery      = {}
  lastClientePiiQuery    = {}

  const app = express()

  app.get('/pedidos', (req: Request, res: Response) => {
    lastPedidosQuery = req.query as Record<string, string>
    res.status(mockPedidosResponse.status).json(mockPedidosResponse.body)
  })

  app.get('/clientes/pii', (req: Request, res: Response) => {
    lastClientePiiQuery = req.query as Record<string, string>
    res.status(mockClientePiiResponse.status).json(mockClientePiiResponse.body)
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

  it('HG-4: gateway 404 (nenhum resultado) → []', async () => {
    mockPedidosResponse = { status: 404, body: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } }

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
  it('HG-9: happy path — retorna ClienteInterno[] traduzido do shape do gateway', async () => {
    const client   = new HttpGatewayClient(baseUrl)
    const clientes = await client.consultarClientes({})

    expect(clientes).toHaveLength(1)
    const c = clientes[0] as ClienteInterno
    expect(c.clienteId).toBe('CLI-001')
    expect(c.nomeToken).toBe('hmac-nome-abc')
    expect(c.documentoToken).toBe('hmac-doc-xyz')
    expect(c.enderecoToken).toBe('hmac-end-def')
    expect(c.emailToken).toBeNull()
    expect(c.telefoneToken).toBeNull()
    expect(c.bloqueado).toBe(false)
  })

  it('HG-10: filtro documentoToken propagado na querystring', async () => {
    const client = new HttpGatewayClient(baseUrl)
    await client.consultarClientes({ documentoToken: 'hmac-doc-xyz' })

    expect(lastClientesQuery['documentoToken']).toBe('hmac-doc-xyz')
  })
})

// ─── reidentificarCliente ─────────────────────────────────────────────────────

describe('HttpGatewayClient — reidentificarCliente', () => {
  it('HG-11: happy path — retorna ClientePiiView traduzido do shape do gateway', async () => {
    const client  = new HttpGatewayClient(baseUrl)
    const cliente = await client.reidentificarCliente({ clienteId: 'CLI-001', loja: '01' })

    expect(cliente).not.toBeNull()
    expect(cliente?.clienteId).toBe('CLI-001')
    expect(cliente?.nome).toBe('Empresa Exemplo LTDA')
    expect(cliente?.documento).toBe('12.345.678/0001-90')
    expect(cliente?.email).toBe('contato@exemplo.com')
  })

  it('HG-12: gateway 404 → null', async () => {
    mockClientePiiResponse = { status: 404, body: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } }

    const client  = new HttpGatewayClient(baseUrl)
    const cliente = await client.reidentificarCliente({ clienteId: 'CLI-XXX', loja: '01' })

    expect(cliente).toBeNull()
  })

  it('HG-13: clienteId/loja propagados como codigoCliente/loja na querystring', async () => {
    const client = new HttpGatewayClient(baseUrl)
    await client.reidentificarCliente({ clienteId: 'CLI-999', loja: '02' })

    expect(lastClientePiiQuery['codigoCliente']).toBe('CLI-999')
    expect(lastClientePiiQuery['loja']).toBe('02')
  })

  it('HG-14: gateway 500 → GatewayUnavailableError', async () => {
    mockClientePiiResponse = { status: 500, body: { error: 'internal' } }

    const client = new HttpGatewayClient(baseUrl)
    await expect(client.reidentificarCliente({ clienteId: 'CLI-001', loja: '01' }))
      .rejects.toThrow(GatewayUnavailableError)
  })
})
