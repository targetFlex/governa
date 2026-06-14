/**
 * alert.service.ts — Casos de uso do módulo de alertas.
 *
 * Responsabilidades (SRP):
 *   - Listar alertas paginados com filtros
 *   - Retornar / upsert thresholds por kind
 *   - Disparar novo alerta (triggerAlert)
 *   - Atualizar status de um alerta (acknowledge / resolve)
 *
 * Hexagonal: depende SÓ da porta AlertRepository.
 * Sem Prisma, sem Express, sem SSE — concerns separados.
 *
 * Isolamento multi-tenant: tenantId NUNCA vem do body / query —
 * sempre extraído do JWT pelo tenantMiddleware (responsabilidade do router).
 */

import type {
  AlertRepository,
  AlertFilter,
  AlertPage,
} from '../domain/alert-repository.port'
import type {
  Alert,
  AlertKind,
  AlertSeverity,
  AlertStatus,
  AlertThreshold,
} from '../domain/alert.types'

// ─── Payload para disparar novo alerta ───────────────────────────────────────

export interface TriggerAlertInput {
  tenantId:  string
  agentId:   string
  kind:      AlertKind
  severity:  AlertSeverity
  message:   string
  metadata?: Record<string, unknown>
}

// ─── Observadores SSE ────────────────────────────────────────────────────────

type AlertObserver = (alert: Alert) => void

export class AlertService {
  private readonly observers = new Set<AlertObserver>()

  constructor(private readonly repo: AlertRepository) {}

  // ── Leitura ────────────────────────────────────────────────────────────────

  async listAlerts(tenantId: string, filter: AlertFilter = {}): Promise<AlertPage> {
    if (!tenantId) throw new Error('tenantId é obrigatório')
    return this.repo.list(tenantId, filter)
  }

  async listThresholds(tenantId: string): Promise<AlertThreshold[]> {
    if (!tenantId) throw new Error('tenantId é obrigatório')
    return this.repo.listThresholds(tenantId)
  }

  // ── Escrita ────────────────────────────────────────────────────────────────

  /**
   * Upsert de threshold para um kind específico.
   */
  async upsertThreshold(
    tenantId: string,
    kind:     AlertKind,
    patch:    Partial<Omit<AlertThreshold, 'id' | 'tenantId' | 'kind' | 'updatedAt'>>,
  ): Promise<AlertThreshold> {
    if (!tenantId) throw new Error('tenantId é obrigatório')
    return this.repo.upsertThreshold(tenantId, kind, patch)
  }

  /**
   * Dispara um novo alerta e notifica observadores SSE.
   */
  async triggerAlert(input: TriggerAlertInput): Promise<Alert> {
    if (!input.tenantId) throw new Error('tenantId é obrigatório')
    if (!input.agentId)  throw new Error('agentId é obrigatório')

    const alert = await this.repo.create({
      tenantId: input.tenantId,
      agentId:  input.agentId,
      kind:     input.kind,
      severity: input.severity,
      status:   'OPEN',
      message:  input.message,
      metadata: input.metadata ?? {},
    })

    // notifica todos os clientes SSE conectados
    this.observers.forEach((fn) => fn(alert))

    return alert
  }

  /**
   * Atualiza status de um alerta (OPEN → ACKNOWLEDGED → RESOLVED).
   */
  async updateStatus(tenantId: string, id: string, status: AlertStatus): Promise<Alert> {
    if (!tenantId) throw new Error('tenantId é obrigatório')
    if (!id)       throw new Error('id é obrigatório')
    return this.repo.updateStatus(tenantId, id, status)
  }

  // ── Observadores SSE ──────────────────────────────────────────────────────

  subscribe(fn: AlertObserver): () => void {
    this.observers.add(fn)
    return () => this.observers.delete(fn)
  }
}
