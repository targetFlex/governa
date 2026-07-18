import type { IGatewayClient, ClientePiiView } from '../../../shared/ports/gateway-client.port'
import type { AuditService } from '../../audit/application/audit.service'
import type { Outcome } from '../../audit/domain/outcome'
import { ClienteNotFoundError, GatewayUnavailableError } from '../domain/cliente.errors'

export interface ReidentificarClienteInput {
  readonly tenantId:     string
  readonly agentId:      string
  readonly subjectToken: string   // HMAC do sujeito (LGPD) — ver panel-access.resolver
  readonly clienteId:    string
  readonly loja:         string
  readonly spanId?:      string
}

export interface ReidentificarClienteOutput {
  readonly cliente:   ClientePiiView
  readonly traceId:   string
  readonly latencyMs: number
}

/**
 * ReidentificarClienteUseCase — resolve PII em texto claro de UM cliente
 * específico, para exibição no painel administrativo (uso humano).
 *
 * Diferença deliberada em relação a ConsultarClienteUseCase:
 *   - Nunca chamado por um agente de IA (rota exclusiva do painel).
 *   - purpose/toolCalled próprios — distingue no audit trail o momento em
 *     que um humano visualizou PII em claro do momento em que um agente
 *     consultou dados pseudonimizados.
 *   - Registro único (sem paginação/busca) — sempre exige resultado.
 *
 * Hexagonal: depende SÓ de IGatewayClient (porta) e AuditService.
 *
 * LGPD: dataCategories inclui 'identificacao' + 'dados_pessoais'.
 *   AuditEvent é gravado SEMPRE (sucesso ou falha) — rastreabilidade de
 *   quem visualizou PII em claro e quando.
 */
export class ReidentificarClienteUseCase {
  constructor(
    private readonly gatewayClient: IGatewayClient,
    private readonly auditService:  AuditService,
  ) {}

  async execute(input: ReidentificarClienteInput): Promise<ReidentificarClienteOutput> {
    const startMs = Date.now()

    let cliente: ClientePiiView | null
    let outcome: Outcome = 'EXECUTADO'
    let gatewayError: GatewayUnavailableError | undefined

    try {
      cliente = await this.gatewayClient.reidentificarCliente({
        clienteId: input.clienteId,
        loja:      input.loja,
      })
    } catch (err) {
      outcome      = 'ERRO'
      gatewayError = err instanceof GatewayUnavailableError
        ? err
        : new GatewayUnavailableError(String(err))
      cliente      = null
    }

    const latencyMs = Date.now() - startMs

    // Grava audit SEMPRE — sucesso ou falha (rastreabilidade LGPD)
    const auditEvent = await this.auditService.createEvent({
      tenantId:       input.tenantId,
      agentId:        input.agentId,
      action:         'reidentificar_cliente',
      toolCalled:     'read_protheus_cliente_pii',
      inputSummary:   `reidentificar_cliente[cli=${input.clienteId},loja=${input.loja}]`,
      outcome:        cliente === null && !gatewayError ? 'ERRO' : outcome,
      latencyMs,
      subjectToken:   input.subjectToken,
      dataCategories: ['identificacao', 'dados_pessoais'],
      legalBasis:     'execucao_contrato',
      purpose:        'exibicao_painel_humano',
      spanId:         input.spanId,
    })

    // Re-lança após audit gravado
    if (gatewayError) throw gatewayError

    if (!cliente) {
      throw new ClienteNotFoundError(`${input.clienteId}/${input.loja}`)
    }

    return {
      cliente,
      traceId: auditEvent.traceId,
      latencyMs,
    }
  }
}
