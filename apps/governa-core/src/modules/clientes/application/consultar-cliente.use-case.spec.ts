import { ConsultarClienteUseCase } from './consultar-cliente.use-case'
import { ClienteNotFoundError, GatewayUnavailableError } from '../domain/cliente.errors'
import { AuditService } from '../../audit/application/audit.service'
import { PiiDetector } from '../../audit/application/pii-detector'
import { InMemoryAuditEventRepository } from '../../../../test/fixtures/in-memory-audit-event.repository'
import { InMemoryGatewayClient } from '../../../../test/fixtures/in-memory-gateway-client'
import type { ClienteInterno } from '../domain/cliente.entity'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCliente(overrides: Partial<ClienteInterno> = {}): ClienteInterno {
  return {
    clienteId:      'CLI001',
    loja:           '01',
    nomeToken:      'a'.repeat(64),
    documentoToken: 'b'.repeat(64),
    enderecoToken:  'c'.repeat(64),
    emailToken:     null,
    telefoneToken:  null,
    bloqueado:      false,
    ...overrides,
  }
}

function buildSut() {
  const auditRepo     = new InMemoryAuditEventRepository()
  const gatewayClient = new InMemoryGatewayClient()
  const auditService  = new AuditService(auditRepo, new PiiDetector())
  const useCase       = new ConsultarClienteUseCase(gatewayClient, auditService)

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

describe('ConsultarClienteUseCase', () => {
  // CC-1: happy path — lista clientes sem filtro
  it('CC-1: retorna lista de clientes quando gateway responde com sucesso', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.seedClientes([buildCliente()])

    const output = await useCase.execute({ ...BASE_INPUT, filtros: {} })

    expect(output.clientes).toHaveLength(1)
    expect(output.clientes[0].clienteId).toBe('CLI001')
    expect(output.traceId).toBeTruthy()
    expect(output.latencyMs).toBeGreaterThanOrEqual(0)
  })

  // CC-2: happy path — filtro por clienteId encontrado
  it('CC-2: filtra cliente por clienteId quando existe', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.seedClientes([
      buildCliente({ clienteId: 'CLI001' }),
      buildCliente({ clienteId: 'CLI002' }),
    ])

    const output = await useCase.execute({ ...BASE_INPUT, filtros: { clienteId: 'CLI001' } })

    expect(output.clientes).toHaveLength(1)
    expect(output.clientes[0].clienteId).toBe('CLI001')
  })

  // CC-3: busca específica por clienteId sem resultado → ClienteNotFoundError
  it('CC-3: lança ClienteNotFoundError quando clienteId não existe no gateway', async () => {
    const { useCase } = buildSut()

    await expect(
      useCase.execute({ ...BASE_INPUT, filtros: { clienteId: 'INEXISTENTE' } })
    ).rejects.toThrow(ClienteNotFoundError)
  })

  // CC-4: busca por documentoToken sem resultado → ClienteNotFoundError
  it('CC-4: lança ClienteNotFoundError quando documentoToken não existe', async () => {
    const { useCase } = buildSut()

    await expect(
      useCase.execute({ ...BASE_INPUT, filtros: { documentoToken: 'z'.repeat(64) } })
    ).rejects.toThrow(ClienteNotFoundError)
  })

  // CC-5: lista sem filtro vazia → [] sem erro
  it('CC-5: retorna array vazio (sem erro) quando gateway não tem clientes e não há filtro específico', async () => {
    const { useCase } = buildSut()

    const output = await useCase.execute({ ...BASE_INPUT, filtros: {} })

    expect(output.clientes).toEqual([])
  })

  // CC-6: gateway indisponível → GatewayUnavailableError re-lançado
  it('CC-6: lança GatewayUnavailableError quando gateway está indisponível', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.simulateUnavailable()

    await expect(
      useCase.execute({ ...BASE_INPUT, filtros: {} })
    ).rejects.toThrow(GatewayUnavailableError)
  })

  // CC-7: audit gravado em caso de sucesso
  it('CC-7: grava AuditEvent com outcome EXECUTADO após consulta bem-sucedida', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    gatewayClient.seedClientes([buildCliente()])

    await useCase.execute({ ...BASE_INPUT, filtros: {} })

    const events = auditRepo.all()
    expect(events).toHaveLength(1)
    expect(events[0].outcome).toBe('EXECUTADO')
    expect(events[0].action).toBe('consultar_clientes')
    expect(events[0].toolCalled).toBe('read_protheus_cliente')
    expect(events[0].tenantId).toBe('tenant-test')
    expect(events[0].agentId).toBe('agent-test')
  })

  // CC-8: audit gravado mesmo quando gateway falha (LGPD)
  it('CC-8: grava AuditEvent com outcome ERRO quando gateway está indisponível', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    gatewayClient.simulateUnavailable()

    await expect(useCase.execute({ ...BASE_INPUT, filtros: {} })).rejects.toThrow()

    const events = auditRepo.all()
    expect(events).toHaveLength(1)
    expect(events[0].outcome).toBe('ERRO')
  })

  // CC-9: audit contém categorias LGPD obrigatórias para dados de clientes
  it('CC-9: AuditEvent contém dataCategories e legalBasis corretos (LGPD)', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    gatewayClient.seedClientes([buildCliente()])

    await useCase.execute({ ...BASE_INPUT, filtros: {} })

    const event = auditRepo.all()[0]
    expect(event.dataCategories).toContain('identificacao')
    expect(event.dataCategories).toContain('dados_pessoais')
    expect(event.legalBasis).toBe('execucao_contrato')
    expect(event.purpose).toBe('consulta_cliente_atendimento')
  })

  // CC-10: inputSummary não expõe documentoToken em texto claro
  it('CC-10: AuditEvent.inputSummary mascara documentoToken (nunca expõe o token real)', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    const docToken = 'd'.repeat(64)
    gatewayClient.seedClientes([buildCliente({ documentoToken: docToken })])

    await useCase.execute({ ...BASE_INPUT, filtros: { documentoToken: docToken } })

    const event = auditRepo.all()[0]
    expect(event.inputSummary).toContain('<token>')
    expect(event.inputSummary).not.toContain(docToken)
  })

  // CC-11: IGatewayClient.consultarClientes chamado com filtros corretos
  it('CC-11: IGatewayClient.consultarClientes é chamado com os filtros corretos', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.seedClientes([buildCliente({ clienteId: 'CLI001' })])

    await useCase.execute({ ...BASE_INPUT, filtros: { clienteId: 'CLI001' } })

    expect(gatewayClient.calls.consultarClientes).toHaveLength(1)
    expect(gatewayClient.calls.consultarClientes[0]).toEqual({ clienteId: 'CLI001' })
  })

  // CC-12: cliente bloqueado é retornado normalmente (decisão do domínio, não do use case)
  it('CC-12: retorna cliente bloqueado sem erro (bloqueio é decisão do chamador)', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.seedClientes([buildCliente({ bloqueado: true })])

    const output = await useCase.execute({ ...BASE_INPUT, filtros: {} })

    expect(output.clientes).toHaveLength(1)
    expect(output.clientes[0].bloqueado).toBe(true)
  })
})
