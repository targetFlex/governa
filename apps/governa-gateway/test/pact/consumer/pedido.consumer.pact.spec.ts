// ============================================================
// pedido.consumer.pact.spec.ts
//
// Consumer Pact: governa-gateway → protheus-rest (endpoint /PEDIDO/)
//
// Padrão Pact v12: uma instância por teste com porta aleatória.
// Cada teste cria um novo Pact (porta random), registra UMA interação,
// faz o request, verifica e finaliza. pactfileWriteMode:'merge' acumula
// todas as interações no mesmo governa-gateway-protheus-rest.json.
//
// Interações cobertas:
//   CA1: GET /PEDIDO/?C5_NUM=000001  → 200, PedidoInterno mapeado
//   CA2: GET /PEDIDO/?C5_NUM=999999  → 404 → UpstreamError(httpStatus=404)
//   CA3: GET /PEDIDO/?C5_NUM=000002  → 500 → UpstreamError(httpStatus=500)
//   CA4: GET /PEDIDO/?C5_CLIENTE=CLI001 → 200, pedidos por cliente
//
// Referências:
//   schema:    src/connectors/pedido/pedido.schema.ts
//   mapper:    src/connectors/pedido/pedido.mapper.ts
//   connector: src/connectors/pedido/read-protheus-pedido.connector.ts
//   errors:    src/shared/errors/protheus-errors.ts
// ============================================================

import path from 'path'
import axios from 'axios'
import { Pact, Matchers } from '@pact-foundation/pact'
import { ReadProtheusPedidoConnector } from '../../../src/connectors/pedido/read-protheus-pedido.connector'
import { PedidoMapper } from '../../../src/connectors/pedido/pedido.mapper'

const { like, eachLike, term } = Matchers

const PACT_DIR = path.resolve(__dirname, '../pacts')
const LOG_DIR  = path.resolve(__dirname, '../logs')

// ── Payload reutilizável ──────────────────────────────────────

const pedidoPayload = {
  C5_NUM:     like('000001'),
  C5_CLIENTE: like('CLI001'),
  C5_LOJA:    like('01'),
  C5_EMISSAO: term({ generate: '20260524', matcher: '^\\d{8}$' }),
  C5_VALOR:   like(1500.00),
  C5_STATUS:  term({ generate: 'A', matcher: '^(A|B|E|L)$' }),
  C5_ITENS:   eachLike({
    D2_COD:    like('PROD01'),
    D2_QUANT:  like(2),
    D2_PRCVEN: like(750.00),
  }),
}

// ── Factory: cria instância Pact + connector com porta aleatória ──
// Uma instância por teste evita conflito de porta no TCP TIME_WAIT.

function makePactAndConnector() {
  const provider = new Pact({
    consumer:          'governa-gateway',
    provider:          'protheus-rest',
    // porta 0 → Pact escolhe uma porta livre automaticamente
    dir:               PACT_DIR,
    log:               path.resolve(LOG_DIR, 'pedido-consumer.log'),
    logLevel:          'warn',
    pactfileWriteMode: 'merge',
  })

  // O buildConnector usa a porta real depois de setup() + addInteraction()
  const buildConnector = (port: number): ReadProtheusPedidoConnector =>
    new ReadProtheusPedidoConnector(
      axios.create({ baseURL: `http://localhost:${port}` }),
      new PedidoMapper(),
    )

  return { provider, buildConnector }
}

// ── Suite ─────────────────────────────────────────────────────
// Cada teste é autocontido: setup → addInteraction → request → verify → finalize

describe('Pact Consumer: governa-gateway → protheus-rest (pedido)', () => {

  // ── CA1: pedido encontrado ───────────────────────────────

  it('CA1: GET /PEDIDO/?C5_NUM=000001 → 200, PedidoInterno mapeado corretamente', async () => {
    const { provider, buildConnector } = makePactAndConnector()
    await provider.setup()
    const port: number = (provider as any).opts.port

    await provider.addInteraction({
      state:         'pedido 000001 existe no Protheus',
      uponReceiving: 'GET /PEDIDO/ com C5_NUM=000001',
      withRequest: {
        method: 'GET',
        path:   '/PEDIDO/',
        query:  { C5_NUM: '000001' },
      },
      willRespondWith: {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
        body:    eachLike(pedidoPayload, { min: 1 }),
      },
    })

    const result = await buildConnector(port).execute({ numeroPedido: '000001' })

    expect(result).toHaveLength(1)
    expect(result[0].numeroPedido).toBe('000001')
    expect(result[0].clienteId).toBe('CLI001')
    expect(result[0].status).toBe('ABERTO')
    expect(result[0].valorTotal).toBe(1500.00)
    expect(result[0].itens).toHaveLength(1)
    expect(result[0].itens[0].codigoProduto).toBe('PROD01')
    expect(result[0].itens[0].quantidade).toBe(2)
    expect(result[0].itens[0].precoUnitario).toBe(750.00)
    expect(result[0].dataEmissao).toBeInstanceOf(Date)

    await provider.verify()
    await provider.finalize()
  })

  // ── CA2: pedido não encontrado (404) ─────────────────────

  it('CA2: GET /PEDIDO/?C5_NUM=999999 → 404 → UpstreamError(httpStatus=404, PROTHEUS_NOT_FOUND)', async () => {
    const { provider, buildConnector } = makePactAndConnector()
    await provider.setup()
    const port: number = (provider as any).opts.port

    await provider.addInteraction({
      state:         'pedido 999999 não existe no Protheus',
      uponReceiving: 'GET /PEDIDO/ com C5_NUM=999999',
      withRequest: {
        method: 'GET',
        path:   '/PEDIDO/',
        query:  { C5_NUM: '999999' },
      },
      willRespondWith: {
        status:  404,
        headers: { 'Content-Type': 'application/json' },
        body:    { status: 404, message: 'Pedido não encontrado' },
      },
    })

    await expect(buildConnector(port).execute({ numeroPedido: '999999' }))
      .rejects.toMatchObject({
        name:       'UpstreamError',
        httpStatus: 404,
        code:       'PROTHEUS_NOT_FOUND',
        source:     'read_protheus_pedido',
      })

    await provider.verify()
    await provider.finalize()
  })

  // ── CA3: erro interno do Protheus (500) ───────────────────

  it('CA3: GET /PEDIDO/?C5_NUM=000002 → 500 → UpstreamError(httpStatus=500, PROTHEUS_INTERNAL_ERROR)', async () => {
    const { provider, buildConnector } = makePactAndConnector()
    await provider.setup()
    const port: number = (provider as any).opts.port

    await provider.addInteraction({
      state:         'Protheus em erro interno ao buscar pedido',
      uponReceiving: 'GET /PEDIDO/ com C5_NUM=000002',
      withRequest: {
        method: 'GET',
        path:   '/PEDIDO/',
        query:  { C5_NUM: '000002' },
      },
      willRespondWith: {
        status:  500,
        headers: { 'Content-Type': 'application/json' },
        body:    { status: 500, message: 'Internal Server Error' },
      },
    })

    await expect(buildConnector(port).execute({ numeroPedido: '000002' }))
      .rejects.toMatchObject({
        name:       'UpstreamError',
        httpStatus: 500,
        code:       'PROTHEUS_INTERNAL_ERROR',
      })

    await provider.verify()
    await provider.finalize()
  })

  // ── CA4: filtro por cliente ───────────────────────────────

  it('CA4: GET /PEDIDO/?C5_CLIENTE=CLI001 → 200, pedidos filtrados por cliente', async () => {
    const { provider, buildConnector } = makePactAndConnector()
    await provider.setup()
    const port: number = (provider as any).opts.port

    await provider.addInteraction({
      state:         'cliente CLI001 tem pedidos no Protheus',
      uponReceiving: 'GET /PEDIDO/ com C5_CLIENTE=CLI001',
      withRequest: {
        method: 'GET',
        path:   '/PEDIDO/',
        query:  { C5_CLIENTE: 'CLI001' },
      },
      willRespondWith: {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
        body:    eachLike(pedidoPayload, { min: 1 }),
      },
    })

    const result = await buildConnector(port).execute({ clienteId: 'CLI001' })

    expect(result.length).toBeGreaterThanOrEqual(1)
    result.forEach((p) => expect(p.clienteId).toBe('CLI001'))

    await provider.verify()
    await provider.finalize()
  })
})
