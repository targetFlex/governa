import type { IGatewayClient, ConsultarClientesParams } from '../../../shared/ports/gateway-client.port'
import type { AuditService } from '../../audit/application/audit.service'
import type { ClienteInterno } from '../domain/cliente.entity'
import type { Outcome } from '../../audit/domain/outcome'
import { ClienteNotFoundError, GatewayUnavailableError } from '../domain/cliente.errors'

export interface ConsultarClienteInput {
  readonly tenantId:      string
  readonly agentId:       string
  readonly subjectToken:  string   // HMAC do sujeito (LGPD)
  readonly filtros:       ConsultarClientesParams
  readonly spanId?:       string
}

export interface ConsultarClienteOutput {
  readonly clientes:  ClienteInterno[]
  readonly traceId:   string
  readonly latencyMs: number
}

/**
 * ConsultarClienteUseCase — caso de uso de consulta de clientes.
 *
 * Orquestra:
 *   1. Busca clientes via IGatewayClient (porta — sem dep de HTTP)
 *   2. Grava AuditEvent (ferramenta, outcome, latência, LGPD)
 *   3. Retorna clientes ao chamador
 *
 * Regras de negócio:
 *   - Busca por clienteId ou documentoToken sem resultado → lança
 *     ClienteNotFoundError (busca específica exige resultado).
 *   - Lista sem filtro vazia → [] sem erro.
 *   - Gateway indisponível → re-lança GatewayUnavailableError APÓS gravar
 *     audit event com outcome 'ERRO' (rastreabilidade LGPD).
 *
 * Hexagonal: depende SÓ de IGatewayClient (porta) e AuditService.
 * Sem dep de Axios, Express ou Prisma.
 *
 * LGPD: dataCategories inclui 'identificacao' + 'dados_pessoais'.
 *   subjectToken pseudonimiza o titular — nenhum PII em texto claro
 *   é gravado no AuditEvent.
 */
export class ConsultarClienteUseCase {
  constructor(
    private readonly gatewayClient: IGatewayClient,
    private readonly auditService:  AuditService,
  ) {}

  async execute(input: ConsultarClienteInput): Promise<ConsultarClienteOutput> {
    const startMs = Date.now()

    let clientes: ClienteInterno[]
    let outcome: Outcome = 'EXECUTADO'
    let gatewayError: GatewayUnavailableError | undefined

    try {
      clientes = await this.gatewayClient.consultarClientes(input.filtros)
    } catch (err) {
      outcome      = 'ERRO'
      gatewayError = err instanceof GatewayUnavailableError
        ? err
        : new GatewayUnavailableError(String(err))
      clientes     = []
    }

    const latencyMs = Date.now() - startMs

    // Grava audit SEMPRE — sucesso ou falha (rastreabilidade LGPD)
    const auditEvent = await this.auditService.createEvent({
      tenantId:       input.tenantId,
      agentId:        input.agentId,
      action:         'consultar_clientes',
      toolCalled:     'read_protheus_cliente',
      inputSummary:   this.buildSummary(input.filtros),
      outcome,
      latencyMs,
      subjectToken:   input.subjectToken,
      dataCategories: ['identificacao', 'dados_pessoais'],
      legalBasis:     'execucao_contrato',
      purpose:        'consulta_cliente_atendimento',
      spanId:         input.spanId,
    })

    // Re-lança após audit gravado
    if (gatewayError) throw gatewayError

    // Busca específica → exige resultado
    if ((input.filtros.clienteId || input.filtros.documentoToken) && clientes.length === 0) {
      const identifier = input.filtros.clienteId ?? input.filtros.documentoToken ?? 'desconhecido'
      throw new ClienteNotFoundError(identifier)
    }

    return {
      clientes,
      traceId:   auditEvent.traceId,
      latencyMs,
    }
  }

  private buildSummary(filtros: ConsultarClientesParams): string {
    const parts: string[] = []
    if (filtros.clienteId)      parts.push(`cli=${filtros.clienteId}`)
    if (filtros.documentoToken) parts.push(`doc=<token>`)   // nunca expõe o token real
    return parts.length > 0
      ? `consultar_clientes[${parts.join(',')}]`
      : 'consultar_clientes[sem-filtro]'
  }
}
