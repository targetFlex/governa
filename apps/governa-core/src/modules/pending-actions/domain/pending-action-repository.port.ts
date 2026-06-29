import type { PendingAction, PendingActionPayload } from './pending-action.entity'

export interface CreatePendingActionInput {
  readonly tenantId:  string
  readonly agentId:   string
  readonly toolName:  string
  readonly payload:   PendingActionPayload
  readonly expiresAt: Date
}

export interface ApprovePendingActionInput {
  readonly approverId:      string
  readonly responseMessage?: string
}

export interface PendingActionRepository {
  create(input: CreatePendingActionInput): Promise<PendingAction>
  findById(id: string, tenantId: string): Promise<PendingAction | null>
  findPendingByTenant(tenantId: string): Promise<PendingAction[]>
  approve(id: string, tenantId: string, input: ApprovePendingActionInput): Promise<PendingAction>
  reject(id: string, tenantId: string, approverId: string): Promise<PendingAction>
  expireStale(before: Date): Promise<number>
}
