// ============================================================
// gateway.consumer.pact.spec.ts
//
// Consumer Pact: governa-core → governa-gateway (futura REST API)
//
// Padrão Pact v12: uma instância por teste com porta aleatória.
// Define o contrato que governa-core espera da API REST do governa-gateway
// quando a integração ERP↔Core for ativada (design-first TDD de contrato).
//
// Interações cobertas:
//   CC1: GET /pedidos?numeroPedido=000001 → 200, PedidoInterno
//   CC2: GET /pedidos?numeroPedido=999999 → 404, erro estruturado
//   CC3: GET /clientes?codigoCliente=CLI001 → 200, ClienteInterno (PII pseudo)
//   CC4: GET /clientes?codigoCliente=ZZZ999 → 404, erro estruturado
// ============================================================

import path from 'path'
import axios from 'axios'
import { Pact, Matchers } from '@pact-foundation/pact'

const { like, term, eachLike } = Matchers

const PACT_DIR = path.resolve(__dirname, '../pacts')
const LOG_DIR  = path.resolve(__dirname, '../logs')

// ── Payloads reutilizáveis ────────────────────────────────────

const pedidoInterno = {
  numeroPedido: like('000001'),
  clienteId:    like('CLI001'),
  loja:         like('01'),
  dataEmissao:  like('2026-05-24T00:00:00.000Z'),
  valorTotal:   like(1500.00),
  status:       term({ generate: 'ABERTO', matcher: '^(ABERTO|BLOQUEADO|ENCERRADO|LIBERADO)$' }),
  itens: eachLike({
    codigoProduto: like('PROD01'),
    quantidade:    like(2),
    precoUnitario: like(750.00),
  }),
}

const clienteInterno = {
  codigoCliente:   like('CLI001'),
  loja:            like('01'),
  nomePseudo:      like('d'.repeat(64)),
  tipo:            term({ generate: 'JURIDICA', matcher: '^(FISICA|JURIDICA)$' }),
  ativo:           like(true),
  documentoPseudo: like('a'.repeat(64)),
  emailPseudo:     like('b'.repeat(64)),
  telefonePseudo:  like('c'.repeat(64)),
  enderecoPseudo:  like('e'.repeat(64)),
}

const erroNaoEncontrado = {
  code:    like('NOT_FOUND'),
  message: like('Recurso não encontrado'),
}

// ── Factory: instância Pact com porta aleatória ───────────────

function makePact() {
  return new Pact({
    consumer:          'governa-core',
    provider:          'governa-gateway',
    dir:               PACT_DIR,
    log:               path.resolve(LOG_DIR, 'gateway-consumer.log'),
    logLevel:          'warn',
    pactfileWriteMode: 'merge',
  })
}

// ── Suite ─────────────────────────────────────────────────────

describe('Pact Consumer: governa-core → governa-gateway (futura API REST)', () => {

  // ── CC1: pedido encontrado ────────────────────────────────

  it('CC1: GET /pedidos?numeroPedido=000001 → 200, PedidoInterno', async () => {
    const provider = makePact()
    await provider.setup()
    const port: number = (provider as any).opts.port
    const client = axios.create({ baseURL: `http://localhost:${port}` })

    await provider.addInteraction({
      state:         'pedido 000001 disponível no gateway',
      uponReceiving: 'GET /pedidos?numeroPedido=000001',
      withRequest: {
        method: 'GET',
        path:   '/pedidos',
        query:  { numeroPedido: '000001' },
      },
      willRespondWith: {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
        body:    { data: eachLike(pedidoInterno, { min: 1 }) },
      },
    })

    const res = await client.get('/pedidos', { params: { numeroPedido: '000001' } })

    expect(res.status).toBe(200)
    expect(res.data.data).toHaveLength(1)
    expect(res.data.data[0].numeroPedido).toBe('000001')
    expect(res.data.data[0].status).toBe('ABERTO')

    await provider.verify()
    await provider.finalize()
  })

  // ── CC2: pedido não encontrado ────────────────────────────

  it('CC2: GET /pedidos?numeroPedido=999999 → 404, erro estruturado', async () => {
    const provider = makePact()
    await provider.setup()
    const port: number = (provider as any).opts.port
    const client = axios.create({ baseURL: `http://localhost:${port}` })

    await provider.addInteraction({
      state:         'pedido 999999 não existe no gateway',
      uponReceiving: 'GET /pedidos?numeroPedido=999999',
      withRequest: {
        method: 'GET',
        path:   '/pedidos',
        query:  { numeroPedido: '999999' },
      },
      willRespondWith: {
        status:  404,
        headers: { 'Content-Type': 'application/json' },
        body:    erroNaoEncontrado,
      },
    })

    await expect(
      client.get('/pedidos', { params: { numeroPedido: '999999' } }),
    ).rejects.toMatchObject({ response: { status: 404 } })

    await provider.verify()
    await provider.finalize()
  })

  // ── CC3: cliente encontrado ───────────────────────────────

  it('CC3: GET /clientes?codigoCliente=CLI001 → 200, ClienteInterno com PII pseudo', async () => {
    const provider = makePact()
    await provider.setup()
    const port: number = (provider as any).opts.port
    const client = axios.create({ baseURL: `http://localhost:${port}` })

    await provider.addInteraction({
      state:         'cliente CLI001 disponível no gateway',
      uponReceiving: 'GET /clientes?codigoCliente=CLI001',
      withRequest: {
        method: 'GET',
        path:   '/clientes',
        query:  { codigoCliente: 'CLI001' },
      },
      willRespondWith: {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
        body:    { data: eachLike(clienteInterno, { min: 1 }) },
      },
    })

    const res = await client.get('/clientes', { params: { codigoCliente: 'CLI001' } })

    expect(res.status).toBe(200)
    expect(res.data.data).toHaveLength(1)
    expect(res.data.data[0].codigoCliente).toBe('CLI001')
    // PII pseudonimizada — 64 hex chars
    expect(res.data.data[0].documentoPseudo).toHaveLength(64)

    await provider.verify()
    await provider.finalize()
  })

  // ── CC4: cliente não encontrado ───────────────────────────

  it('CC4: GET /clientes?codigoCliente=ZZZ999 → 404, erro estruturado', async () => {
    const provider = makePact()
    await provider.setup()
    const port: number = (provider as any).opts.port
    const client = axios.create({ baseURL: `http://localhost:${port}` })

    await provider.addInteraction({
      state:         'cliente ZZZ999 não existe no gateway',
      uponReceiving: 'GET /clientes?codigoCliente=ZZZ999',
      withRequest: {
        method: 'GET',
        path:   '/clientes',
        query:  { codigoCliente: 'ZZZ999' },
      },
      willRespondWith: {
        status:  404,
        headers: { 'Content-Type': 'application/json' },
        body:    erroNaoEncontrado,
      },
    })

    await expect(
      client.get('/clientes', { params: { codigoCliente: 'ZZZ999' } }),
    ).rejects.toMatchObject({ response: { status: 404 } })

    await provider.verify()
    await provider.finalize()
  })
})
