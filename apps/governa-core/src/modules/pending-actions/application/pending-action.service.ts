import type { PendingActionRepository, CreatePendingActionInput, ApprovePendingActionInput } from '../domain/pending-action-repository.port'
import type { PendingAction } from '../domain/pending-action.entity'

export class PendingActionNotFoundError extends Error {
  readonly code = 'PENDING_ACTION_NOT_FOUND' as const
  constructor(id: string) {
    super(`PendingAction ${id} não encontrado`)
    this.name = 'PendingActionNotFoundError'
  }
}

export class PendingActionAlreadyResolvedError extends Error {
  readonly code = 'PENDING_ACTION_ALREADY_RESOLVED' as const
  constructor(id: string, status: string) {
    super(`PendingAction ${id} já resolvido (status: ${status})`)
    this.name = 'PendingActionAlreadyResolvedError'
  }
}

// 24 horas de TTL por padrão
const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000

export class PendingActionService {
  constructor(private readonly repo: PendingActionRepository) {}

  async create(input: Omit<CreatePendingActionInput, 'expiresAt'> & { expiresAt?: Date }): Promise<PendingAction> {
    return this.repo.create({
      ...input,
      expiresAt: input.expiresAt ?? new Date(Date.now() + DEFAULT_EXPIRY_MS),
    })
  }

  async listPending(tenantId: string): Promise<PendingAction[]> {
    return this.repo.findPendingByTenant(tenantId)
  }

  async findById(id: string, tenantId: string): Promise<PendingAction> {
    const action = await this.repo.findById(id, tenantId)
    if (!action) throw new PendingActionNotFoundError(id)
    return action
  }

  async approve(id: string, tenantId: string, input: ApprovePendingActionInput): Promise<PendingAction> {
    const current = await this.findById(id, tenantId)
    if (current.status !== 'PENDING') {
      throw new PendingActionAlreadyResolvedError(id, current.status)
    }

    const approved = await this.repo.approve(id, tenantId, input)

    // Retomada: se havia callbackUrl, notifica Fluig com o resultado da aprovação
    if (approved.payload.callbackUrl) {
      this.sendResolutionCallback(approved, input.responseMessage).catch(err => {
        console.error('[PendingActionService] callback de retomada falhou', approved.id, err)
      })
    }

    return approved
  }

  async reject(id: string, tenantId: string, approverId: string): Promise<PendingAction> {
    const current = await this.findById(id, tenantId)
    if (current.status !== 'PENDING') {
      throw new PendingActionAlreadyResolvedError(id, current.status)
    }
    return this.repo.reject(id, tenantId, approverId)
  }

  async expireStale(): Promise<number> {
    return this.repo.expireStale(new Date())
  }

  // ── Retomada: envia resultado ao BPM Fluig ────────────────────────────────

  private async sendResolutionCallback(action: PendingAction, responseMessage?: string): Promise<void> {
    const body = {
      type:            'pending_action_resolved',
      ticketId:        action.payload.ticketId,
      sessionId:       action.payload.sessionId,
      status:          action.status,
      escalationSummary: action.payload.escalationSummary,
      responseMessage: responseMessage ?? null,
      resolvedBy:      action.approverId,
      resolvedAt:      action.resolvedAt?.toISOString(),
    }

    await fetch(action.payload.callbackUrl!, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(10_000),
    })
  }
}
