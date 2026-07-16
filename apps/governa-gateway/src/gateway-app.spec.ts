// ============================================================
// gateway-app.spec.ts
//
// Testes unitários do GatewayHttpServer.
// Connectors injetados como mocks — sem Protheus real.
//
// Cobertura:
//   POST /auth/login — AL-OK (200), AL-400 (body inválido), AL-401 (credenciais erradas), AL-502
//   GET  /pedidos    — CC1 (200), CC2 (404 vazio), CC2b (UpstreamError NOT_FOUND)
//   GET  /clientes   — CC3 (200), CC4 (404 vazio), CC4b (UpstreamError NOT_FOUND)
//   Erros:           upstream 502, ZodError/genérico 500
// ============================================================

import http from 'http'
import { GatewayHttpServer, IPedidoConnector, IClienteConnector, IAuthLoginConnector } from './gateway-app'
import { UpstreamError } from './connectors/shared/upstream-error.handler'
import { PedidoInterno } from './connectors/pedido/pedido.schema'
import { ClienteInterno } from './connectors/cliente/cliente.schema'

// ── Helpers ──────────────────────────────────────────────────

function get(port: number, path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${path}`, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) })
        } catch {
          resolve({ status: res.statusCode ?? 0, body: raw })
        }
      })
    }).on('error', reject)
  })
}

function post(
  port: number,
  path: string,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }
    const req = http.request(options, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) })
        } catch {
          resolve({ status: res.statusCode ?? 0, body: raw })
        }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

// ── Fixtures ─────────────────────────────────────────────────

const pedidoFixture: PedidoInterno = {
  numeroPedido: '000001',
  clienteId:    'CLI001',
  loja:         '01',
  dataEmissao:  new Date('2026-05-24T00:00:00.000Z'),
  valorTotal:   1500.00,
  status:       'ABERTO',
  itens: [{ codigoProduto: 'PROD01', quantidade: 2, precoUnitario: 750.00 }],
}

const clienteFixture: ClienteInterno = {
  codigoCliente:   'CLI001',
  loja:            '01',
  nomePseudo:      'd'.repeat(64),
  tipo:            'JURIDICA',
  ativo:           true,
  documentoPseudo: 'a'.repeat(64),
  emailPseudo:     'b'.repeat(64),
  telefonePseudo:  'c'.repeat(64),
  enderecoPseudo:  'e'.repeat(64),
}

// ── Suite ─────────────────────────────────────────────────────

describe('GatewayHttpServer', () => {
  let server: GatewayHttpServer
  let port: number
  let mockPedido: jest.MockedFunction<IPedidoConnector['execute']>
  let mockCliente: jest.MockedFunction<IClienteConnector['execute']>
  let mockAuth: jest.MockedFunction<IAuthLoginConnector['execute']>

  beforeEach(async () => {
    mockPedido  = jest.fn()
    mockCliente = jest.fn()
    mockAuth    = jest.fn()
    server = new GatewayHttpServer(
      { execute: mockPedido  },
      { execute: mockCliente },
      { execute: mockAuth    },
    )
    port = await server.listen(0) // porta aleatória
  })

  afterEach(async () => {
    await server.close()
  })

  // ── POST /auth/login ─────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('AL-OK: 200 com token e expiresIn quando credenciais válidas', async () => {
      mockAuth.mockResolvedValueOnce({ token: 'jwt-abc', expiresIn: 3600 })
      const res = await post(port, '/auth/login', { email: 'admin@empresa.com', password: 'sec' })

      expect(res.status).toBe(200)
      const body = res.body as { token: string; expiresIn: number }
      expect(body.token).toBe('jwt-abc')
      expect(body.expiresIn).toBe(3600)
    })

    it('AL-400: body sem email → 400 VALIDATION_ERROR', async () => {
      const res = await post(port, '/auth/login', { password: 'sec' })

      expect(res.status).toBe(400)
      expect((res.body as any).code).toBe('VALIDATION_ERROR')
    })

    it('AL-400: body sem password → 400 VALIDATION_ERROR', async () => {
      const res = await post(port, '/auth/login', { email: 'admin@empresa.com' })

      expect(res.status).toBe(400)
      expect((res.body as any).code).toBe('VALIDATION_ERROR')
    })

    it('AL-400: email vazio (só espaços) → 400 VALIDATION_ERROR', async () => {
      const res = await post(port, '/auth/login', { email: '   ', password: 'sec' })

      expect(res.status).toBe(400)
      expect((res.body as any).code).toBe('VALIDATION_ERROR')
    })

    it('AL-401: credenciais rejeitadas pelo Protheus → 401 UNAUTHORIZED', async () => {
      mockAuth.mockRejectedValueOnce(
        new UpstreamError('PROTHEUS_UNAUTHORIZED', 'Credenciais rejeitadas', 401, 'auth_login'),
      )
      const res = await post(port, '/auth/login', { email: 'user@empresa.com', password: 'wrong' })

      expect(res.status).toBe(401)
      expect((res.body as any).code).toBe('UNAUTHORIZED')
    })

    it('AL-502: Protheus indisponível → 502 com código upstream', async () => {
      mockAuth.mockRejectedValueOnce(
        new UpstreamError('PROTHEUS_AUTH_UNAVAILABLE', 'Protheus fora do ar', 503, 'auth_login'),
      )
      const res = await post(port, '/auth/login', { email: 'admin@empresa.com', password: 'sec' })

      expect(res.status).toBe(502)
      expect((res.body as any).code).toBe('PROTHEUS_AUTH_UNAVAILABLE')
    })

    it('AL-500: erro inesperado → 500 INTERNAL_ERROR', async () => {
      mockAuth.mockRejectedValueOnce(new Error('Erro catastrófico'))
      const res = await post(port, '/auth/login', { email: 'admin@empresa.com', password: 'sec' })

      expect(res.status).toBe(500)
      expect((res.body as any).code).toBe('INTERNAL_ERROR')
    })

    it('repassa email (sem espaços) e password corretos para o conector', async () => {
      mockAuth.mockResolvedValueOnce({ token: 'tok', expiresIn: 1800 })
      await post(port, '/auth/login', { email: '  admin@empresa.com  ', password: 'abc123' })

      expect(mockAuth).toHaveBeenCalledWith({ email: 'admin@empresa.com', password: 'abc123' })
    })
  })

  // ── GET /pedidos ────────────────────────────────────────────

  describe('GET /pedidos', () => {
    it('CC1: 200 com pedido encontrado', async () => {
      mockPedido.mockResolvedValueOnce([pedidoFixture])
      const res = await get(port, '/pedidos?numeroPedido=000001')

      expect(res.status).toBe(200)
      const body = res.body as { data: typeof pedidoFixture[] }
      expect(body.data).toHaveLength(1)
      expect(body.data[0].numeroPedido).toBe('000001')
      expect(body.data[0].status).toBe('ABERTO')
    })

    it('CC2: 404 quando conector retorna lista vazia', async () => {
      mockPedido.mockResolvedValueOnce([])
      const res = await get(port, '/pedidos?numeroPedido=999999')

      expect(res.status).toBe(404)
      const body = res.body as { code: string; message: string }
      expect(body.code).toBe('NOT_FOUND')
      expect(body.message).toBe('Recurso não encontrado')
    })

    it('CC2b: 404 quando conector lança UpstreamError NOT_FOUND', async () => {
      mockPedido.mockRejectedValueOnce(new UpstreamError('PROTHEUS_NOT_FOUND', 'Pedido não encontrado', 404, 'test'))
      const res = await get(port, '/pedidos?numeroPedido=999999')

      expect(res.status).toBe(404)
      expect((res.body as any).code).toBe('NOT_FOUND')
    })

    it('502 quando conector lança UpstreamError PROTHEUS_TIMEOUT', async () => {
      mockPedido.mockRejectedValueOnce(new UpstreamError('PROTHEUS_TIMEOUT', 'Timeout', 408, 'test'))
      const res = await get(port, '/pedidos?numeroPedido=000001')

      expect(res.status).toBe(502)
      expect((res.body as any).code).toBe('PROTHEUS_TIMEOUT')
    })

    it('500 quando conector lança erro genérico', async () => {
      mockPedido.mockRejectedValueOnce(new Error('Erro inesperado'))
      const res = await get(port, '/pedidos?numeroPedido=000001')

      expect(res.status).toBe(500)
      expect((res.body as any).code).toBe('INTERNAL_ERROR')
    })

    it('passa query params corretos para o conector', async () => {
      mockPedido.mockResolvedValueOnce([pedidoFixture])
      await get(port, '/pedidos?numeroPedido=000001&clienteId=CLI001')

      expect(mockPedido).toHaveBeenCalledWith(
        expect.objectContaining({ numeroPedido: '000001', clienteId: 'CLI001' }),
      )
    })
  })

  // ── GET /clientes ───────────────────────────────────────────

  describe('GET /clientes', () => {
    it('CC3: 200 com cliente encontrado e PII pseudonimizada', async () => {
      mockCliente.mockResolvedValueOnce([clienteFixture])
      const res = await get(port, '/clientes?codigoCliente=CLI001')

      expect(res.status).toBe(200)
      const body = res.body as { data: typeof clienteFixture[] }
      expect(body.data).toHaveLength(1)
      expect(body.data[0].codigoCliente).toBe('CLI001')
      expect(body.data[0].documentoPseudo).toHaveLength(64)
    })

    it('CC4: 404 quando conector retorna lista vazia', async () => {
      mockCliente.mockResolvedValueOnce([])
      const res = await get(port, '/clientes?codigoCliente=ZZZ999')

      expect(res.status).toBe(404)
      const body = res.body as { code: string; message: string }
      expect(body.code).toBe('NOT_FOUND')
      expect(body.message).toBe('Recurso não encontrado')
    })

    it('CC4b: 404 quando conector lança UpstreamError NOT_FOUND', async () => {
      mockCliente.mockRejectedValueOnce(new UpstreamError('PROTHEUS_NOT_FOUND', 'Cliente não encontrado', 404, 'test'))
      const res = await get(port, '/clientes?codigoCliente=ZZZ999')

      expect(res.status).toBe(404)
      expect((res.body as any).code).toBe('NOT_FOUND')
    })

    it('502 quando conector lança UpstreamError PROTHEUS_INTERNAL_ERROR', async () => {
      mockCliente.mockRejectedValueOnce(new UpstreamError('PROTHEUS_INTERNAL_ERROR', 'Erro Protheus', 500, 'test'))
      const res = await get(port, '/clientes?codigoCliente=CLI001')

      expect(res.status).toBe(502)
      expect((res.body as any).code).toBe('PROTHEUS_INTERNAL_ERROR')
    })

    it('500 quando conector lança erro genérico', async () => {
      mockCliente.mockRejectedValueOnce(new Error('Falha catastrófica'))
      const res = await get(port, '/clientes?codigoCliente=CLI001')

      expect(res.status).toBe(500)
      expect((res.body as any).code).toBe('INTERNAL_ERROR')
    })

    it('passa query params corretos para o conector', async () => {
      mockCliente.mockResolvedValueOnce([clienteFixture])
      await get(port, '/clientes?codigoCliente=CLI001&loja=01')

      expect(mockCliente).toHaveBeenCalledWith(
        expect.objectContaining({ codigoCliente: 'CLI001', loja: '01' }),
      )
    })

    it('repassa documentoToken do query string para o conector', async () => {
      mockCliente.mockResolvedValueOnce([clienteFixture])
      await get(port, '/clientes?documentoToken=abc123hash')

      expect(mockCliente).toHaveBeenCalledWith(
        expect.objectContaining({ documentoToken: 'abc123hash' }),
      )
    })
  })

  // ── Ciclo de vida ────────────────────────────────────────────

  describe('listen / close', () => {
    it('listen(0) retorna porta efetiva > 0', async () => {
      expect(port).toBeGreaterThan(0)
    })

    it('close() encerra sem erro', async () => {
      await expect(server.close()).resolves.toBeUndefined()
    })

    it('close() sem server iniciado resolve imediatamente', async () => {
      const s = new GatewayHttpServer({ execute: jest.fn() }, { execute: jest.fn() }, { execute: jest.fn() })
      await expect(s.close()).resolves.toBeUndefined()
    })
  })
})
