// ============================================================
// cliente.consumer.pact.spec.ts
//
// Consumer Pact: governa-gateway → protheus-rest (endpoint /CLIENTE/)
//
// Padrão Pact v12: uma instância por teste com porta aleatória.
// pactfileWriteMode:'merge' acumula interações no mesmo arquivo
// governa-gateway-protheus-rest.json (junto com pedido.consumer.pact.spec.ts).
//
// Interações cobertas:
//   CA5: GET /CLIENTE/?A1_COD=CLI001 → 200, ClienteInterno (PII pseudo)
//   CA6: GET /CLIENTE/?A1_COD=ZZZ999 → 404 → UpstreamError(httpStatus=404)
//   CA7: GET /CLIENTE/?A1_CGC=12345678000195 → 200, busca por CNPJ
//   CA8: GET /CLIENTE/?A1_ATIVO=S → 200, clientes ativos
//
// Referências:
//   schema:    src/connectors/cliente/cliente.schema.ts
//   mapper:    src/connectors/cliente/cliente.mapper.ts
//   connector: src/connectors/cliente/read-protheus-cliente.connector.ts
// ============================================================

import path from 'path'
import axios from 'axios'
import { Pact, Matchers } from '@pact-foundation/pact'
import { ReadProtheusCilenteConnector } from '../../../src/connectors/cliente/read-protheus-cliente.connector'
import { ClienteMapper } from '../../../src/connectors/cliente/cliente.mapper'
import { PiiPseudonymizer } from '../../../src/connectors/shared/pii.pseudonymizer'

const { like, term } = Matchers

const PACT_DIR = path.resolve(__dirname, '../pacts')
const LOG_DIR  = path.resolve(__dirname, '../logs')

// ── PII pseudonymizer de teste ────────────────────────────────
// Chave estável e conhecida — permite assertions determinísticas nos hashes.
const TEST_PII_SECRET = 'test-pact-pii-secret-32-chars-ok'
const pseudonymizer   = new PiiPseudonymizer(TEST_PII_SECRET)

// ── Payload reutilizável ──────────────────────────────────────

const clientePayload = {
  A1_COD:   like('CLI001'),
  A1_LOJA:  like('01'),
  A1_NOME:  like('Empresa Teste LTDA'),
  A1_END:   like('Rua das Flores, 123'),
  A1_MUN:   like('São Paulo'),
  A1_EST:   like('SP'),
  A1_CEP:   term({ generate: '01310100', matcher: '^\\d{8}$' }),
  A1_CGC:   like('12345678000195'),
  A1_EMAIL: like('contato@empresa.com'),
  A1_TEL:   like('11999999999'),
  A1_TIPO:  term({ generate: 'J', matcher: '^(F|J)$' }),
  A1_ATIVO: term({ generate: 'S', matcher: '^(S|N)$' }),
}

// ── Factory: cria instância Pact + connector com porta aleatória ──

function makePactAndConnector() {
  const provider = new Pact({
    consumer:          'governa-gateway',
    provider:          'protheus-rest',
    dir:               PACT_DIR,
    log:               path.resolve(LOG_DIR, 'cliente-consumer.log'),
    logLevel:          'warn',
    pactfileWriteMode: 'merge',
  })

  const buildConnector = (port: number): ReadProtheusCilenteConnector =>
    new ReadProtheusCilenteConnector(
      axios.create({ baseURL: `http://localhost:${port}` }),
      new ClienteMapper(pseudonymizer),
    )

  return { provider, buildConnector }
}

// ── Suite ─────────────────────────────────────────────────────

describe('Pact Consumer: governa-gateway → protheus-rest (cliente)', () => {

  // ── CA5: cliente encontrado (PII pseudonimizada) ──────────

  it('CA5: GET /CLIENTE/?A1_COD=CLI001 → 200, ClienteInterno com PII pseudonimizada', async () => {
    const { provider, buildConnector } = makePactAndConnector()
    await provider.setup()
    const port: number = (provider as any).opts.port

    await provider.addInteraction({
      state:         'cliente CLI001 existe no Protheus',
      uponReceiving: 'GET /CLIENTE/ com A1_COD=CLI001',
      withRequest: {
        method: 'GET',
        path:   '/CLIENTE/',
        query:  { A1_COD: 'CLI001' },
      },
      willRespondWith: {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
        body:    [clientePayload],
      },
    })

    const result = await buildConnector(port).execute({ codigoCliente: 'CLI001' })

    expect(result).toHaveLength(1)
    const c = result[0]
    expect(c.codigoCliente).toBe('CLI001')
    expect(c.loja).toBe('01')
    expect(c.tipo).toBe('JURIDICA')
    expect(c.ativo).toBe(true)
    // PII nunca em texto claro — somente hashes determinísticos
    expect(c.nomePseudo).toBe(pseudonymizer.pseudonymize('Empresa Teste LTDA'))
    expect(c.documentoPseudo).toBe(pseudonymizer.pseudonymize('12345678000195'))
    expect(c.emailPseudo).toBe(pseudonymizer.pseudonymize('contato@empresa.com'))
    expect(c.telefonePseudo).toBe(pseudonymizer.pseudonymize('11999999999'))
    expect(c.enderecoPseudo).toBe(
      pseudonymizer.pseudonymize('Rua das Flores, 123|São Paulo|SP|01310100'),
    )

    await provider.verify()
    await provider.finalize()
  })

  // ── CA6: cliente não encontrado (404) ─────────────────────

  it('CA6: GET /CLIENTE/?A1_COD=ZZZ999 → 404 → UpstreamError(httpStatus=404, PROTHEUS_NOT_FOUND)', async () => {
    const { provider, buildConnector } = makePactAndConnector()
    await provider.setup()
    const port: number = (provider as any).opts.port

    await provider.addInteraction({
      state:         'cliente ZZZ999 não existe no Protheus',
      uponReceiving: 'GET /CLIENTE/ com A1_COD=ZZZ999',
      withRequest: {
        method: 'GET',
        path:   '/CLIENTE/',
        query:  { A1_COD: 'ZZZ999' },
      },
      willRespondWith: {
        status:  404,
        headers: { 'Content-Type': 'application/json' },
        body:    { status: 404, message: 'Cliente não encontrado' },
      },
    })

    await expect(buildConnector(port).execute({ codigoCliente: 'ZZZ999' }))
      .rejects.toMatchObject({
        name:       'UpstreamError',
        httpStatus: 404,
        code:       'PROTHEUS_NOT_FOUND',
        source:     'read_protheus_cliente',
      })

    await provider.verify()
    await provider.finalize()
  })

  // ── CA7: busca por CNPJ/CPF ───────────────────────────────

  it('CA7: GET /CLIENTE/?A1_CGC=12345678000195 → 200, busca por documento fiscal', async () => {
    const { provider, buildConnector } = makePactAndConnector()
    await provider.setup()
    const port: number = (provider as any).opts.port

    await provider.addInteraction({
      state:         'cliente com CNPJ 12345678000195 existe no Protheus',
      uponReceiving: 'GET /CLIENTE/ com A1_CGC=12345678000195',
      withRequest: {
        method: 'GET',
        path:   '/CLIENTE/',
        query:  { A1_CGC: '12345678000195' },
      },
      willRespondWith: {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
        body:    [clientePayload],
      },
    })

    const result = await buildConnector(port).execute({ cgc: '12345678000195' })

    expect(result).toHaveLength(1)
    // PII pseudonimizada — hash de 64 chars (SHA-256 em hex)
    expect(result[0].documentoPseudo).toHaveLength(64)

    await provider.verify()
    await provider.finalize()
  })

  // ── CA8: filtro por status ativo ──────────────────────────

  it('CA8: GET /CLIENTE/?A1_ATIVO=S → 200, lista clientes ativos', async () => {
    const { provider, buildConnector } = makePactAndConnector()
    await provider.setup()
    const port: number = (provider as any).opts.port

    await provider.addInteraction({
      state:         'existem clientes ativos no Protheus',
      uponReceiving: 'GET /CLIENTE/ com A1_ATIVO=S',
      withRequest: {
        method: 'GET',
        path:   '/CLIENTE/',
        query:  { A1_ATIVO: 'S' },
      },
      willRespondWith: {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
        body:    [clientePayload],
      },
    })

    const result = await buildConnector(port).execute({ ativo: 'S' })

    expect(result.length).toBeGreaterThanOrEqual(1)
    result.forEach((c) => expect(c.ativo).toBe(true))

    await provider.verify()
    await provider.finalize()
  })
})
