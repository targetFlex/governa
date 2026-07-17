import { ConsultarPedidoUseCase } from './consultar-pedido.use-case'
import { PedidoNotFoundError, GatewayUnavailableError } from '../domain/pedido.errors'
import { AuditService } from '../../audit/application/audit.service'
import { PiiDetector } from '../../audit/application/pii-detector'
import { InMemoryAuditEventRepository } from '../../../../test/fixtures/in-memory-audit-event.repository'
import { InMemoryGatewayClient } from '../../../../test/fixtures/in-memory-gateway-client'
import type { PedidoInterno } from '../domain/pedido.entity'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPedido(overrides: Partial<PedidoInterno> = {}): PedidoInterno {
  return {
    numeroPedido: '000001',
    clienteId:    'CLI001',
    loja:         '01',
    dataEmissao:  new Date('2026-05-30'),
    valorTotal:   1500,
    status:       'ABERTO',
    itens:        [{ codigoProduto: 'PROD01', quantidade: 2, precoUnitario: 750 }],
    ...overrides,
  }
}

function buildSut() {
  const auditRepo     = new InMemoryAuditEventRepository()
  const gatewayClient = new InMemoryGatewayClient()
  const auditService  = new AuditService(auditRepo, new PiiDetector())
  const useCase       = new ConsultarPedidoUseCase(gatewayClient, auditService)

  return { useCase, gatewayClient, auditRepo }
}

const BASE_INPUT = {
  tenantId:     'tenant-test',
  agentId:      'agent-test',
  subjectToken: 'a'.repeat(64),  // HMAC fake válido
  filtros:      {},
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('ConsultarPedidoUseCase', () => {
  // CP-1: happy path — lista pedidos sem filtro
  it('CP-1: retorna lista de pedidos quando gateway responde com sucesso', async () => {
    const { useCase, gatewayClient } = buildSut()
    const pedido = buildPedido()
    gatewayClient.seedPedidos([pedido])

    const output = await useCase.execute({ ...BASE_INPUT, filtros: {} })

    expect(output.pedidos).toHaveLength(1)
    expect(output.pedidos[0].numeroPedido).toBe('000001')
    expect(output.traceId).toBeTruthy()
    expect(output.latencyMs).toBeGreaterThanOrEqual(0)
  })

  // CP-2: happy path — filtro por numeroPedido encontrado
  it('CP-2: filtra pedido por numeroPedido quando existe', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.seedPedidos([buildPedido({ numeroPedido: '000001' }), buildPedido({ numeroPedido: '000002' })])

    const output = await useCase.execute({ ...BASE_INPUT, filtros: { numeroPedido: '000001' } })

    expect(output.pedidos).toHaveLength(1)
    expect(output.pedidos[0].numeroPedido).toBe('000001')
  })

  // CP-3: busca específica por número sem resultado → PedidoNotFoundError
  it('CP-3: lança PedidoNotFoundError quando numeroPedido não existe no gateway', async () => {
    const { useCase } = buildSut()

    await expect(
      useCase.execute({ ...BASE_INPUT, filtros: { numeroPedido: '999999' } })
    ).rejects.toThrow(PedidoNotFoundError)
  })

  // CP-4: lista sem filtro vazia → [] sem erro
  it('CP-4: retorna array vazio (sem erro) quando gateway não tem pedidos e não há filtro de número', async () => {
    const { useCase } = buildSut()

    const output = await useCase.execute({ ...BASE_INPUT, filtros: {} })

    expect(output.pedidos).toEqual([])
  })

  // CP-5: gateway indisponível → GatewayUnavailableError re-lançado
  it('CP-5: lança GatewayUnavailableError quando gateway está indisponível', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.simulateUnavailable()

    await expect(
      useCase.execute({ ...BASE_INPUT, filtros: {} })
    ).rejects.toThrow(GatewayUnavailableError)
  })

  // CP-6: audit gravado em caso de sucesso
  it('CP-6: grava AuditEvent com outcome SUCCESS após consulta bem-sucedida', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    gatewayClient.seedPedidos([buildPedido()])

    await useCase.execute({ ...BASE_INPUT, filtros: {} })

    const events = auditRepo.all()
    expect(events).toHaveLength(1)
    expect(events[0].outcome).toBe('EXECUTADO')
    expect(events[0].action).toBe('consultar_pedidos')
    expect(events[0].toolCalled).toBe('read_protheus_pedido')
    expect(events[0].tenantId).toBe('tenant-test')
    expect(events[0].agentId).toBe('agent-test')
  })

  // CP-7: audit gravado mesmo quando gateway falha
  it('CP-7: grava AuditEvent com outcome FAILURE quando gateway está indisponível', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    gatewayClient.simulateUnavailable()

    await expect(useCase.execute({ ...BASE_INPUT, filtros: {} })).rejects.toThrow()

    const events = auditRepo.all()
    expect(events).toHaveLength(1)
    expect(events[0].outcome).toBe('ERRO')
  })

  // CP-8: audit contém categorias LGPD obrigatórias
  it('CP-8: AuditEvent contém dataCategories e legalBasis corretos (LGPD)', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    gatewayClient.seedPedidos([buildPedido()])

    await useCase.execute({ ...BASE_INPUT, filtros: {} })

    const event = auditRepo.all()[0]
    expect(event.dataCategories).toContain('identificacao')
    expect(event.dataCategories).toContain('financeiro')
    expect(event.legalBasis).toBe('execucao_contrato')
    expect(event.purpose).toBe('consulta_pedido_atendimento')
  })

  // CP-9: inputSummary reflete os filtros passados (sem PII)
  it('CP-9: AuditEvent.inputSummary inclui filtros sem expor PII', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    gatewayClient.seedPedidos([buildPedido()])

    await useCase.execute({ ...BASE_INPUT, filtros: { numeroPedido: '000001' } })

    const event = auditRepo.all()[0]
    expect(event.inputSummary).toContain('000001')
    expect(event.inputSummary).not.toMatch(/cpf|email|telefone/i)
  })

  // CP-10: gatewayClient recebe exatamente os filtros passados
  it('CP-10: IGatewayClient.consultarPedidos é chamado com os filtros corretos', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.seedPedidos([buildPedido({ clienteId: 'CLI001' })])

    await useCase.execute({ ...BASE_INPUT, filtros: { clienteId: 'CLI001' } })

    expect(gatewayClient.calls.consultarPedidos).toHaveLength(1)
    expect(gatewayClient.calls.consultarPedidos[0]).toEqual({ clienteId: 'CLI001' })
  })

  // CP-11: output.total é igual a pedidos.length quando não há paginação (compat)
  it('CP-11: output.total é igual a pedidos.length quando não há paginação', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.seedPedidos([buildPedido({ numeroPedido: '000001' }), buildPedido({ numeroPedido: '000002' })])

    const output = await useCase.execute({ ...BASE_INPUT, filtros: {} })

    expect(output.total).toBe(2)
  })

  // CP-12: q filtra por numeroPedido, clienteId e status
  it('CP-12: q filtra pedidos por numeroPedido, clienteId ou status (substring, case-insensitive)', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.seedPedidos([
      buildPedido({ numeroPedido: '000001', clienteId: 'CLI001', status: 'ABERTO' }),
      buildPedido({ numeroPedido: '000002', clienteId: 'CLI002', status: 'BLOQUEADO' }),
      buildPedido({ numeroPedido: '000003', clienteId: 'CLI003', status: 'ENCERRADO' }),
    ])

    const porNumero = await useCase.execute({ ...BASE_INPUT, filtros: {}, q: '000002' })
    expect(porNumero.pedidos.map((p) => p.numeroPedido)).toEqual(['000002'])

    const porStatus = await useCase.execute({ ...BASE_INPUT, filtros: {}, q: 'aberto' })
    expect(porStatus.pedidos.map((p) => p.numeroPedido)).toEqual(['000001'])
  })

  // CP-13: paginacao fatia a lista e total reflete o total filtrado (não a página atual)
  it('CP-13: paginacao fatia a lista e total reflete o total filtrado (não a página atual)', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.seedPedidos([
      buildPedido({ numeroPedido: '000001' }),
      buildPedido({ numeroPedido: '000002' }),
      buildPedido({ numeroPedido: '000003' }),
    ])

    const output = await useCase.execute({
      ...BASE_INPUT,
      filtros: {},
      paginacao: { page: 2, pageSize: 2 },
    })

    expect(output.pedidos).toHaveLength(1)
    expect(output.pedidos[0].numeroPedido).toBe('000003')
    expect(output.total).toBe(3)
  })
})
