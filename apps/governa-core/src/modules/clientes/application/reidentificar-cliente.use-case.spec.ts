import { ReidentificarClienteUseCase } from './reidentificar-cliente.use-case'
import { ClienteNotFoundError, GatewayUnavailableError } from '../domain/cliente.errors'
import { AuditService } from '../../audit/application/audit.service'
import { PiiDetector } from '../../audit/application/pii-detector'
import { InMemoryAuditEventRepository } from '../../../../test/fixtures/in-memory-audit-event.repository'
import { InMemoryGatewayClient } from '../../../../test/fixtures/in-memory-gateway-client'
import type { ClientePiiView } from '../../../shared/ports/gateway-client.port'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildClientePii(overrides: Partial<ClientePiiView> = {}): ClientePiiView {
  return {
    clienteId: 'CLI001',
    loja:      '01',
    nome:      'Empresa Exemplo LTDA',
    documento: '12.345.678/0001-90',
    email:     'contato@exemplo.com',
    telefone:  '(11) 4000-0000',
    endereco:  'Rua Exemplo, 1|São Paulo|SP|01000000',
    ...overrides,
  }
}

function buildSut() {
  const auditRepo     = new InMemoryAuditEventRepository()
  const gatewayClient = new InMemoryGatewayClient()
  const auditService  = new AuditService(auditRepo, new PiiDetector())
  const useCase       = new ReidentificarClienteUseCase(gatewayClient, auditService)

  return { useCase, gatewayClient, auditRepo }
}

const BASE_INPUT = {
  tenantId:     'tenant-test',
  agentId:      'agent-test',
  subjectToken: 'a'.repeat(64),  // HMAC fake válido
  clienteId:    'CLI001',
  loja:         '01',
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('ReidentificarClienteUseCase', () => {
  // RC-1: happy path — resolve PII em texto claro
  it('RC-1: retorna PII em claro quando o gateway encontra o cliente', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.seedClientesPii([buildClientePii()])

    const output = await useCase.execute(BASE_INPUT)

    expect(output.cliente.nome).toBe('Empresa Exemplo LTDA')
    expect(output.cliente.documento).toBe('12.345.678/0001-90')
    expect(output.traceId).toBeTruthy()
    expect(output.latencyMs).toBeGreaterThanOrEqual(0)
  })

  // RC-2: cliente não encontrado → ClienteNotFoundError
  it('RC-2: lança ClienteNotFoundError quando o gateway não encontra o cliente', async () => {
    const { useCase } = buildSut()

    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow(ClienteNotFoundError)
  })

  // RC-3: gateway indisponível → GatewayUnavailableError re-lançado
  it('RC-3: lança GatewayUnavailableError quando gateway está indisponível', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.simulateUnavailable()

    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow(GatewayUnavailableError)
  })

  // RC-4: audit gravado em caso de sucesso
  it('RC-4: grava AuditEvent com outcome EXECUTADO e purpose de exibição no painel', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    gatewayClient.seedClientesPii([buildClientePii()])

    await useCase.execute(BASE_INPUT)

    const events = auditRepo.all()
    expect(events).toHaveLength(1)
    expect(events[0].outcome).toBe('EXECUTADO')
    expect(events[0].action).toBe('reidentificar_cliente')
    expect(events[0].toolCalled).toBe('read_protheus_cliente_pii')
    expect(events[0].purpose).toBe('exibicao_painel_humano')
  })

  // RC-5: audit gravado mesmo quando cliente não é encontrado
  it('RC-5: grava AuditEvent com outcome ERRO quando cliente não é encontrado', async () => {
    const { useCase, auditRepo } = buildSut()

    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow(ClienteNotFoundError)

    const events = auditRepo.all()
    expect(events).toHaveLength(1)
    expect(events[0].outcome).toBe('ERRO')
  })

  // RC-6: audit gravado mesmo quando gateway falha (LGPD)
  it('RC-6: grava AuditEvent com outcome ERRO quando gateway está indisponível', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    gatewayClient.simulateUnavailable()

    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow()

    const events = auditRepo.all()
    expect(events).toHaveLength(1)
    expect(events[0].outcome).toBe('ERRO')
  })

  // RC-7: inputSummary nunca contém PII (gate do PiiDetector no AuditService)
  it('RC-7: AuditEvent.inputSummary não contém PII (clienteId/loja não são PII)', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    gatewayClient.seedClientesPii([buildClientePii()])

    await useCase.execute(BASE_INPUT)

    const event = auditRepo.all()[0]
    expect(event.inputSummary).toBe('reidentificar_cliente[cli=CLI001,loja=01]')
  })

  // RC-8: dataCategories/legalBasis corretos (LGPD)
  it('RC-8: AuditEvent contém dataCategories e legalBasis corretos (LGPD)', async () => {
    const { useCase, gatewayClient, auditRepo } = buildSut()
    gatewayClient.seedClientesPii([buildClientePii()])

    await useCase.execute(BASE_INPUT)

    const event = auditRepo.all()[0]
    expect(event.dataCategories).toContain('identificacao')
    expect(event.dataCategories).toContain('dados_pessoais')
    expect(event.legalBasis).toBe('execucao_contrato')
  })

  // RC-9: IGatewayClient.reidentificarCliente chamado com os parâmetros corretos
  it('RC-9: IGatewayClient.reidentificarCliente é chamado com clienteId e loja corretos', async () => {
    const { useCase, gatewayClient } = buildSut()
    gatewayClient.seedClientesPii([buildClientePii()])

    await useCase.execute(BASE_INPUT)

    expect(gatewayClient.calls.reidentificarCliente).toHaveLength(1)
    expect(gatewayClient.calls.reidentificarCliente[0]).toEqual({ clienteId: 'CLI001', loja: '01' })
  })
})
