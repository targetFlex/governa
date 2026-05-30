// ============================================================
// gateway.provider.pact.spec.ts
//
// Provider Verification (manual): governa-gateway verifica
// contratos CC1-CC4 definidos pelo consumer governa-core.
//
// Segue o mesmo padrão de core.provider.pact.spec.ts:
// lê o pact JSON diretamente e itera as interações com
// stateHandlers in-process (sem Pact Verifier binário —
// incompatível com Linux arm64 no ambiente de dev).
//
// Lê: apps/governa-core/test/pact/pacts/governa-core-governa-gateway.json
//
// Provider states:
//   "pedido 000001 disponível no gateway"  → connector retorna pedidoFixture
//   "pedido 999999 não existe no gateway"  → connector retorna []
//   "cliente CLI001 disponível no gateway" → connector retorna clienteFixture
//   "cliente ZZZ999 não existe no gateway" → connector retorna []
// ============================================================

import path from 'path'
import http from 'http'
import fs from 'fs'
import { GatewayHttpServer, IPedidoConnector, IClienteConnector } from '../../../src/gateway-app'
import { PedidoInterno } from '../../../src/connectors/pedido/pedido.schema'
import { ClienteInterno } from '../../../src/connectors/cliente/cliente.schema'

// ── Fixtures alinhados com o pact file ───────────────────────

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
  nome:            'Empresa Teste LTDA',
  tipo:            'JURIDICA',
  ativo:           true,
  documentoPseudo: 'a'.repeat(64),
  emailPseudo:     'b'.repeat(64),
  telefonePseudo:  'c'.repeat(64),
  endereco: {
    logradouro: 'Rua das Flores, 123',
    municipio:  'São Paulo',
    estado:     'SP',
    cep:        '01310100',
  },
}

// ── Connectors controláveis por estado ───────────────────────

let pedidoExecute: jest.Mock
let clienteExecute: jest.Mock

const pedidoConnector: IPedidoConnector = {
  execute: (...args) => pedidoExecute(...args),
}
const clienteConnector: IClienteConnector = {
  execute: (...args) => clienteExecute(...args),
}

// ── State handlers ────────────────────────────────────────────

const stateHandlers: Record<string, () => void> = {
  'pedido 000001 disponível no gateway': () => {
    pedidoExecute  = jest.fn().mockResolvedValue([pedidoFixture])
    clienteExecute = jest.fn().mockResolvedValue([])
  },
  'pedido 999999 não existe no gateway': () => {
    pedidoExecute  = jest.fn().mockResolvedValue([])
    clienteExecute = jest.fn().mockResolvedValue([])
  },
  'cliente CLI001 disponível no gateway': () => {
    pedidoExecute  = jest.fn().mockResolvedValue([])
    clienteExecute = jest.fn().mockResolvedValue([clienteFixture])
  },
  'cliente ZZZ999 não existe no gateway': () => {
    pedidoExecute  = jest.fn().mockResolvedValue([])
    clienteExecute = jest.fn().mockResolvedValue([])
  },
}

// ── Helper: HTTP request para o servidor ──────────────────────

interface PactRequest {
  method: string
  path:   string
  query?: string
}

interface HttpResponse {
  status: number
  body:   unknown
}

function doRequest(port: number, req: PactRequest): Promise<HttpResponse> {
  const fullPath = req.query ? `${req.path}?${req.query}` : req.path

  return new Promise((resolve, reject) => {
    http.get(
      { hostname: '127.0.0.1', port, path: fullPath },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => { raw += chunk })
        res.on('end', () => {
          let body: unknown
          try { body = JSON.parse(raw) } catch { body = raw }
          resolve({ status: res.statusCode ?? 0, body })
        })
      },
    ).on('error', reject)
  })
}

// ── Helper: assertBody com matchingRules Pact V2 ─────────────
//
// Suporte a "type" — verifica que typeof actual === typeof expected.
// Campos sem matchingRule → equality exacta.

function resolvePath(obj: unknown, jpath: string): unknown {
  const parts = jpath.replace(/^\$\.body\./, '').split('.')
  let cur = obj
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function assertBody(
  actual: unknown,
  expected: unknown,
  matchingRules?: Record<string, { match: string }>,
): void {
  if (!matchingRules || Object.keys(matchingRules).length === 0) {
    expect(actual).toEqual(expected)
    return
  }

  const typePaths = new Set<string>()
  for (const [jpath, rule] of Object.entries(matchingRules)) {
    if (rule.match === 'type') typePaths.add(jpath)
  }

  for (const jpath of typePaths) {
    const actualVal   = resolvePath(actual, jpath)
    const expectedVal = resolvePath(expected, jpath)
    expect(typeof actualVal).toBe(typeof expectedVal)
  }

  function deepEqual(act: unknown, exp: unknown, currentPath: string): void {
    if (exp === null || exp === undefined) { expect(act).toBe(exp); return }
    if (typeof exp === 'object' && !Array.isArray(exp)) {
      for (const key of Object.keys(exp as Record<string, unknown>)) {
        const childPath = currentPath ? `${currentPath}.${key}` : key
        if (!typePaths.has(`$.body.${childPath}`)) {
          deepEqual(
            (act as Record<string, unknown>)?.[key],
            (exp as Record<string, unknown>)[key],
            childPath,
          )
        }
      }
    } else {
      expect(act).toEqual(exp)
    }
  }

  deepEqual(actual, expected, '')
}

// ── Setup ─────────────────────────────────────────────────────

let gatewayServer: GatewayHttpServer
let gatewayPort: number

beforeAll(async () => {
  pedidoExecute  = jest.fn().mockResolvedValue([])
  clienteExecute = jest.fn().mockResolvedValue([])

  gatewayServer = new GatewayHttpServer(pedidoConnector, clienteConnector)
  gatewayPort   = await gatewayServer.listen(0)
})

afterAll(async () => {
  await gatewayServer.close()
})

// ── Provider Verification ─────────────────────────────────────

describe('Pact Provider Verification (manual): governa-gateway satisfaz CC1-CC4 do governa-core', () => {
  const pactPath = path.resolve(
    __dirname,
    '../../../../governa-core/test/pact/pacts/governa-core-governa-gateway.json',
  )

  const pactFile = JSON.parse(fs.readFileSync(pactPath, 'utf-8')) as {
    interactions: Array<{
      description:   string
      providerState: string
      request: PactRequest
      response: {
        status:         number
        body?:          unknown
        matchingRules?: Record<string, { match: string }>
      }
    }>
  }

  for (const interaction of pactFile.interactions) {
    it(interaction.description, async () => {
      // 1. Aplicar state handler
      const handler = stateHandlers[interaction.providerState]
      if (!handler) throw new Error(`stateHandler não definido: "${interaction.providerState}"`)
      handler()

      // 2. Disparar request
      const result = await doRequest(gatewayPort, interaction.request)

      // 3. Validar status
      expect(result.status).toBe(interaction.response.status)

      // 4. Validar body
      if (interaction.response.body !== undefined) {
        assertBody(result.body, interaction.response.body, interaction.response.matchingRules)
      }
    })
  }
})
