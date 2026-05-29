// ============================================================
// gateway.e2e.spec.ts — Integração E2E: conectores → Protheus mock
//
// Testa o fluxo completo do governa-gateway contra um servidor
// Protheus simulado rodando in-process (Node.js http.createServer).
//
// Fluxo real exercitado:
//   1. ProtheusAuthClient (basic mode) gera token Basic
//   2. createHttpClient injeta Authorization em cada request
//   3. Connector executa GET real contra o mock via TCP/IP loopback
//   4. Mock Protheus responde com payload raw TOTVS
//   5. Connector valida com Zod e mapeia para modelo interno
//
// Cenários cobertos:
//   E2E-1: pedido encontrado → PedidoInterno mapeado corretamente
//   E2E-2: pedido não encontrado (404) → UpstreamError PROTHEUS_NOT_FOUND
//   E2E-3: cliente encontrado → ClienteInterno com PII pseudonimizada
//   E2E-4: cliente não encontrado (404) → UpstreamError PROTHEUS_NOT_FOUND
//   E2E-5: Protheus retorna 500 → UpstreamError PROTHEUS_INTERNAL_ERROR
//   E2E-6: payload inválido (schema violation) → ZodError propaga
//   E2E-7: timeout → UpstreamError PROTHEUS_TIMEOUT
//   E2E-8: múltiplos pedidos → todos mapeados corretamente
// ============================================================

import http from 'http'
import { AddressInfo } from 'net'
import { ZodError } from 'zod'

import { ProtheusAuthClient } from '../../src/auth/protheus-auth.client'
import { createHttpClient } from '../../src/shared/http/http-client'
import { ReadProtheusPedidoConnector } from '../../src/connectors/pedido/read-protheus-pedido.connector'
import { ReadProtheusCilenteConnector } from '../../src/connectors/cliente/read-protheus-cliente.connector'
import { PedidoMapper } from '../../src/connectors/pedido/pedido.mapper'
import { ClienteMapper } from '../../src/connectors/cliente/cliente.mapper'
import { PiiPseudonymizer } from '../../src/connectors/shared/pii.pseudonymizer'
import { UpstreamError } from '../../src/connectors/shared/upstream-error.handler'
import type { ProtheusAuthConfig } from '../../src/shared/types/auth.types'

// Chave de teste para o pseudonymizer (qualquer string >= 32 bytes)
const TEST_PII_SECRET = 'e2e-test-pii-secret-key-governa-2026'

// ── Timeout estendido para I/O real ─────────────────────────
jest.setTimeout(15_000)

// ── Payloads raw do Protheus ─────────────────────────────────

const RAW_PEDIDO_000001 = {
  C5_NUM:     '000001',
  C5_CLIENTE: 'CLI001',
  C5_LOJA:    '01',
  C5_EMISSAO: '20260524',
  C5_VALOR:   1500.00,
  C5_STATUS:  'A',
  C5_ITENS:   [{ D2_COD: 'PROD01', D2_QUANT: 2, D2_PRCVEN: 750.00 }],
}

const RAW_PEDIDO_000002 = {
  C5_NUM:     '000002',
  C5_CLIENTE: 'CLI002',
  C5_LOJA:    '01',
  C5_EMISSAO: '20260525',
  C5_VALOR:   850.00,
  C5_STATUS:  'B',
  C5_ITENS:   [{ D2_COD: 'PROD02', D2_QUANT: 1, D2_PRCVEN: 850.00 }],
}

const RAW_CLIENTE_CLI001 = {
  A1_COD:   'CLI001',
  A1_LOJA:  '01',
  A1_NOME:  'Empresa Teste LTDA',
  A1_END:   'Rua das Flores, 123',
  A1_MUN:   'São Paulo',
  A1_EST:   'SP',
  A1_CEP:   '01310100',
  A1_CGC:   '12345678000199',
  A1_EMAIL: 'contato@empresa.com.br',
  A1_TEL:   '11999990000',
  A1_TIPO:  'J',
  A1_ATIVO: 'S',
}

// ── Mock Protheus server ─────────────────────────────────────

/**
 * Cria um servidor HTTP que simula o Protheus REST.
 * Cada rota é configurável para controlar o comportamento por teste.
 */
interface MockRoute {
  status: number
  body:   unknown
  delayMs?: number
}

interface MockConfig {
  routes: Map<string, MockRoute>
}

function createMockProtheusServer(config: MockConfig): http.Server {
  const pendingTimers: ReturnType<typeof setTimeout>[] = []

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1`)
    const pathname = url.pathname

    // Rota baseada em pathname (ignora query para lookup)
    const route = config.routes.get(pathname)

    const respond = () => {
      if (!route) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `rota não mapeada: ${pathname}` }))
        return
      }
      res.writeHead(route.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(route.body))
    }

    if (route?.delayMs) {
      const t = setTimeout(respond, route.delayMs)
      pendingTimers.push(t)
      // Cancelar timer se a request for destruída (ex: client timeout)
      req.on('close', () => clearTimeout(t))
    } else {
      respond()
    }
  })

  // Limpar todos os timers pendentes ao fechar o server
  server.on('close', () => pendingTimers.forEach(clearTimeout))

  return server
}

// ── Helpers: connectors ──────────────────────────────────────

function makeBasicConfig(baseUrl: string): ProtheusAuthConfig {
  return {
    baseUrl,
    authMode:       'basic',
    basicUser:      'totvs_user',
    basicPass:      'totvs_pass',
    clientId:       '',
    clientSecret:   '',
    tokenTtlBuffer: 30,
  }
}

function makePedidoConnector(baseUrl: string) {
  const authClient = new ProtheusAuthClient(makeBasicConfig(baseUrl))
  const httpClient = createHttpClient(authClient, baseUrl, 5_000)
  return new ReadProtheusPedidoConnector(httpClient, new PedidoMapper())
}

function makeClienteConnector(baseUrl: string) {
  const authClient = new ProtheusAuthClient(makeBasicConfig(baseUrl))
  const httpClient = createHttpClient(authClient, baseUrl, 5_000)
  return new ReadProtheusCilenteConnector(httpClient, new ClienteMapper(new PiiPseudonymizer(TEST_PII_SECRET)))
}

// ── Suite principal ──────────────────────────────────────────

describe('E2E: governa-gateway connectors → mock Protheus in-process', () => {
  let server: http.Server
  let baseUrl: string

  // ── E2E-1: pedido encontrado ─────────────────────────────

  describe('E2E-1: GET /PEDIDO/ com C5_NUM=000001 → PedidoInterno mapeado', () => {
    beforeAll(
      () =>
        new Promise<void>((resolve) => {
          const cfg: MockConfig = {
            routes: new Map([
              ['/PEDIDO/', { status: 200, body: [RAW_PEDIDO_000001] }],
            ]),
          }
          server = createMockProtheusServer(cfg)
          server.listen(0, '127.0.0.1', () => {
            const port = (server.address() as AddressInfo).port
            baseUrl = `http://127.0.0.1:${port}`
            resolve()
          })
        }),
    )

    afterAll(() => new Promise<void>((res) => server.close(() => res())))

    it('retorna PedidoInterno com campos mapeados corretamente', async () => {
      const connector = makePedidoConnector(baseUrl)
      const result = await connector.execute({ numeroPedido: '000001' })

      expect(result).toHaveLength(1)
      const pedido = result[0]
      expect(pedido.numeroPedido).toBe('000001')
      expect(pedido.clienteId).toBe('CLI001')
      expect(pedido.loja).toBe('01')
      expect(pedido.status).toBe('ABERTO')
      expect(pedido.valorTotal).toBe(1500.00)
      expect(pedido.itens).toHaveLength(1)
      expect(pedido.itens[0].codigoProduto).toBe('PROD01')
      expect(pedido.itens[0].quantidade).toBe(2)
      expect(pedido.itens[0].precoUnitario).toBe(750.00)
    })

    it('dataEmissao é um Date válido derivado de 20260524', async () => {
      const connector = makePedidoConnector(baseUrl)
      const [pedido] = await connector.execute({ numeroPedido: '000001' })

      expect(pedido.dataEmissao).toBeInstanceOf(Date)
      expect(pedido.dataEmissao.getUTCFullYear()).toBe(2026)
      expect(pedido.dataEmissao.getUTCMonth()).toBe(4) // maio = 4 (0-based)
      expect(pedido.dataEmissao.getUTCDate()).toBe(24)
    })
  })

  // ── E2E-2: pedido não encontrado (Protheus retorna 404) ──

  describe('E2E-2: GET /PEDIDO/ → 404 do Protheus → UpstreamError', () => {
    beforeAll(
      () =>
        new Promise<void>((resolve) => {
          const cfg: MockConfig = {
            routes: new Map([
              ['/PEDIDO/', { status: 404, body: { message: 'Registro não encontrado' } }],
            ]),
          }
          server = createMockProtheusServer(cfg)
          server.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
            resolve()
          })
        }),
    )

    afterAll(() => new Promise<void>((res) => server.close(() => res())))

    it('lança UpstreamError com code PROTHEUS_NOT_FOUND e httpStatus 404', async () => {
      const connector = makePedidoConnector(baseUrl)

      await expect(connector.execute({ numeroPedido: '999999' })).rejects.toMatchObject({
        name:       'UpstreamError',
        code:       'PROTHEUS_NOT_FOUND',
        httpStatus: 404,
        source:     'read_protheus_pedido',
      })
    })

    it('UpstreamError é instância de Error', async () => {
      const connector = makePedidoConnector(baseUrl)

      try {
        await connector.execute({ numeroPedido: '999999' })
        fail('deveria ter lançado')
      } catch (err) {
        expect(err).toBeInstanceOf(Error)
        expect(err).toBeInstanceOf(UpstreamError)
      }
    })
  })

  // ── E2E-3: cliente encontrado com PII pseudonimizada ─────

  describe('E2E-3: GET /CLIENTE/ → ClienteInterno com PII pseudo', () => {
    beforeAll(
      () =>
        new Promise<void>((resolve) => {
          const cfg: MockConfig = {
            routes: new Map([
              ['/CLIENTE/', { status: 200, body: [RAW_CLIENTE_CLI001] }],
            ]),
          }
          server = createMockProtheusServer(cfg)
          server.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
            resolve()
          })
        }),
    )

    afterAll(() => new Promise<void>((res) => server.close(() => res())))

    it('retorna ClienteInterno com campos mapeados corretamente', async () => {
      const connector = makeClienteConnector(baseUrl)
      const result = await connector.execute({ codigoCliente: 'CLI001' })

      expect(result).toHaveLength(1)
      const cliente = result[0]
      expect(cliente.codigoCliente).toBe('CLI001')
      expect(cliente.loja).toBe('01')
      expect(cliente.nome).toBe('Empresa Teste LTDA')
      expect(cliente.tipo).toBe('JURIDICA')
      expect(cliente.ativo).toBe(true)
    })

    it('PII está pseudonimizada — nunca o valor real', async () => {
      const connector = makeClienteConnector(baseUrl)
      const [cliente] = await connector.execute({ codigoCliente: 'CLI001' })

      // HMAC SHA-256 = 64 hex chars
      expect(cliente.documentoPseudo).toHaveLength(64)
      expect(cliente.documentoPseudo).not.toContain('12345678000199') // não é o CNPJ real
      expect(cliente.emailPseudo).toHaveLength(64)
      expect(cliente.telefonePseudo).toHaveLength(64)
    })

    it('endereço é mapeado corretamente', async () => {
      const connector = makeClienteConnector(baseUrl)
      const [cliente] = await connector.execute({ codigoCliente: 'CLI001' })

      expect(cliente.endereco.logradouro).toBe('Rua das Flores, 123')
      expect(cliente.endereco.municipio).toBe('São Paulo')
      expect(cliente.endereco.estado).toBe('SP')
      expect(cliente.endereco.cep).toBe('01310100')
    })
  })

  // ── E2E-4: cliente não encontrado ────────────────────────

  describe('E2E-4: GET /CLIENTE/ → 404 do Protheus → UpstreamError', () => {
    beforeAll(
      () =>
        new Promise<void>((resolve) => {
          const cfg: MockConfig = {
            routes: new Map([
              ['/CLIENTE/', { status: 404, body: { message: 'Registro não encontrado' } }],
            ]),
          }
          server = createMockProtheusServer(cfg)
          server.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
            resolve()
          })
        }),
    )

    afterAll(() => new Promise<void>((res) => server.close(() => res())))

    it('lança UpstreamError com code PROTHEUS_NOT_FOUND e httpStatus 404', async () => {
      const connector = makeClienteConnector(baseUrl)

      await expect(connector.execute({ codigoCliente: 'ZZZ999' })).rejects.toMatchObject({
        name:       'UpstreamError',
        code:       'PROTHEUS_NOT_FOUND',
        httpStatus: 404,
        source:     'read_protheus_cliente',
      })
    })
  })

  // ── E2E-5: Protheus retorna 500 ──────────────────────────

  describe('E2E-5: GET /PEDIDO/ → 500 do Protheus → UpstreamError INTERNAL_ERROR', () => {
    beforeAll(
      () =>
        new Promise<void>((resolve) => {
          const cfg: MockConfig = {
            routes: new Map([
              ['/PEDIDO/', { status: 500, body: { error: 'Internal Server Error' } }],
            ]),
          }
          server = createMockProtheusServer(cfg)
          server.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
            resolve()
          })
        }),
    )

    afterAll(() => new Promise<void>((res) => server.close(() => res())))

    it('lança UpstreamError com code PROTHEUS_INTERNAL_ERROR e httpStatus 500', async () => {
      const connector = makePedidoConnector(baseUrl)

      await expect(connector.execute({})).rejects.toMatchObject({
        name:       'UpstreamError',
        code:       'PROTHEUS_INTERNAL_ERROR',
        httpStatus: 500,
      })
    })
  })

  // ── E2E-6: payload inválido — ZodError propaga ───────────

  describe('E2E-6: Protheus retorna payload com schema inválido → ZodError', () => {
    beforeAll(
      () =>
        new Promise<void>((resolve) => {
          const invalid = { ...RAW_PEDIDO_000001, C5_STATUS: 'X' } // status fora do enum
          const cfg: MockConfig = {
            routes: new Map([
              ['/PEDIDO/', { status: 200, body: [invalid] }],
            ]),
          }
          server = createMockProtheusServer(cfg)
          server.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
            resolve()
          })
        }),
    )

    afterAll(() => new Promise<void>((res) => server.close(() => res())))

    it('lança ZodError quando C5_STATUS está fora do enum permitido', async () => {
      const connector = makePedidoConnector(baseUrl)
      await expect(connector.execute({})).rejects.toBeInstanceOf(ZodError)
    })
  })

  // ── E2E-7: timeout real ───────────────────────────────────

  describe('E2E-7: Protheus não responde a tempo → UpstreamError TIMEOUT', () => {
    beforeAll(
      () =>
        new Promise<void>((resolve) => {
          // Delay maior que o timeout do axios client (5_000ms)
          const cfg: MockConfig = {
            routes: new Map([
              ['/PEDIDO/', { status: 200, body: [], delayMs: 7_000 }],
            ]),
          }
          server = createMockProtheusServer(cfg)
          server.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
            resolve()
          })
        }),
    )

    afterAll(() => new Promise<void>((res) => server.close(() => res())))

    it('lança UpstreamError PROTHEUS_TIMEOUT quando axios ultrapassa o timeout', async () => {
      // Timeout de 200ms para não tornar o teste lento (o mock demora 7s)
      const authClient = new ProtheusAuthClient(makeBasicConfig(baseUrl))
      const httpClient = createHttpClient(authClient, baseUrl, 200) // 200ms timeout
      const connector  = new ReadProtheusPedidoConnector(httpClient, new PedidoMapper())

      await expect(connector.execute({})).rejects.toMatchObject({
        name: 'UpstreamError',
        code: 'PROTHEUS_TIMEOUT',
      })
    }, 10_000)
  })

  // ── E2E-8: múltiplos pedidos na resposta ──────────────────

  describe('E2E-8: Protheus retorna múltiplos pedidos → todos mapeados', () => {
    beforeAll(
      () =>
        new Promise<void>((resolve) => {
          const cfg: MockConfig = {
            routes: new Map([
              ['/PEDIDO/', { status: 200, body: [RAW_PEDIDO_000001, RAW_PEDIDO_000002] }],
            ]),
          }
          server = createMockProtheusServer(cfg)
          server.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
            resolve()
          })
        }),
    )

    afterAll(() => new Promise<void>((res) => server.close(() => res())))

    it('retorna os dois pedidos com status corretamente mapeados', async () => {
      const connector = makePedidoConnector(baseUrl)
      const result = await connector.execute({})

      expect(result).toHaveLength(2)
      expect(result[0].numeroPedido).toBe('000001')
      expect(result[0].status).toBe('ABERTO')
      expect(result[1].numeroPedido).toBe('000002')
      expect(result[1].status).toBe('BLOQUEADO')
    })
  })
})
