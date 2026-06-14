// ============================================================
// policy.service.spec.ts
//
// TDD — Given/When/Then
// ============================================================

import { PolicyService, PolicyNotFoundError } from './policy.service'
import type { PolicyRepository }              from '../infrastructure/prisma-policy.repository'
import type { PolicyConfig }                  from '../domain/policy.types'

const TENANT_A = 'tenant-a'
const TENANT_B = 'tenant-b'

const BASE_POLICY: PolicyConfig = {
  id:             'policy-1',
  tenantId:       TENANT_A,
  name:           'Atendimento Consultivo',
  autonomyLevel:  'CONSULTIVO',
  allowedActions: ['read_protheus_pedido', 'read_protheus_cliente'],
  approvers:      [],
  version:        '1.0.0',
}

function makeRepo(overrides: Partial<PolicyRepository> = {}): PolicyRepository {
  return {
    findByIdForTenant: jest.fn().mockResolvedValue(BASE_POLICY),
    findAllForTenant:  jest.fn().mockResolvedValue([BASE_POLICY]),
    update:            jest.fn().mockResolvedValue({ ...BASE_POLICY, version: '1.1.0' }),
    ...overrides,
  }
}

describe('PolicyService.getPolicy', () => {
  it('retorna a política quando encontrada para o tenant', async () => {
    // Given
    const repo    = makeRepo()
    const service = new PolicyService(repo)

    // When
    const result = await service.getPolicy('policy-1', TENANT_A)

    // Then
    expect(result.id).toBe('policy-1')
    expect(repo.findByIdForTenant).toHaveBeenCalledWith('policy-1', TENANT_A)
  })

  it('lança PolicyNotFoundError quando política não existe', async () => {
    // Given
    const repo    = makeRepo({ findByIdForTenant: jest.fn().mockResolvedValue(null) })
    const service = new PolicyService(repo)

    // When / Then
    await expect(service.getPolicy('inexistente', TENANT_A)).rejects.toThrow(PolicyNotFoundError)
  })

  it('lança PolicyNotFoundError para policy de tenant diferente (isolamento)', async () => {
    // Given — repo retorna null porque o tenant não bate
    const repo    = makeRepo({ findByIdForTenant: jest.fn().mockResolvedValue(null) })
    const service = new PolicyService(repo)

    // When / Then
    await expect(service.getPolicy('policy-1', TENANT_B)).rejects.toThrow(PolicyNotFoundError)
  })

  it('PolicyNotFoundError expõe code POLICY_NOT_FOUND', async () => {
    const repo    = makeRepo({ findByIdForTenant: jest.fn().mockResolvedValue(null) })
    const service = new PolicyService(repo)

    const err = await service.getPolicy('x', TENANT_A).catch((e: unknown) => e)
    expect((err as PolicyNotFoundError).code).toBe('POLICY_NOT_FOUND')
  })
})

describe('PolicyService.listPolicies', () => {
  it('retorna lista de políticas do tenant', async () => {
    const repo    = makeRepo()
    const service = new PolicyService(repo)

    const result = await service.listPolicies(TENANT_A)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('policy-1')
    expect(repo.findAllForTenant).toHaveBeenCalledWith(TENANT_A)
  })

  it('retorna lista vazia quando tenant não tem políticas', async () => {
    const repo    = makeRepo({ findAllForTenant: jest.fn().mockResolvedValue([]) })
    const service = new PolicyService(repo)

    const result = await service.listPolicies(TENANT_A)
    expect(result).toHaveLength(0)
  })
})

describe('PolicyService.updatePolicy', () => {
  it('atualiza política e retorna versão bumped', async () => {
    const updated = { ...BASE_POLICY, name: 'Novo Nome', version: '1.1.0' }
    const repo    = makeRepo({ update: jest.fn().mockResolvedValue(updated) })
    const service = new PolicyService(repo)

    const result = await service.updatePolicy('policy-1', TENANT_A, { name: 'Novo Nome' })

    expect(result.name).toBe('Novo Nome')
    expect(result.version).toBe('1.1.0')
    expect(repo.update).toHaveBeenCalledWith('policy-1', TENANT_A, { name: 'Novo Nome' })
  })

  it('lança PolicyNotFoundError quando update retorna null (cross-tenant)', async () => {
    const repo    = makeRepo({ update: jest.fn().mockResolvedValue(null) })
    const service = new PolicyService(repo)

    await expect(
      service.updatePolicy('policy-1', TENANT_B, { name: 'hack' }),
    ).rejects.toThrow(PolicyNotFoundError)
  })

  it('propaga campos opcionais corretamente', async () => {
    const repo    = makeRepo()
    const service = new PolicyService(repo)

    await service.updatePolicy('policy-1', TENANT_A, {
      autonomyLevel:  'ASSISTIDO',
      maxValueBrl:    5000,
      timeWindowH:    24,
      approvers:      ['gestor@empresa.com'],
    })

    expect(repo.update).toHaveBeenCalledWith('policy-1', TENANT_A, {
      autonomyLevel:  'ASSISTIDO',
      maxValueBrl:    5000,
      timeWindowH:    24,
      approvers:      ['gestor@empresa.com'],
    })
  })

  it('permite zerar maxValueBrl com null', async () => {
    const updated = { ...BASE_POLICY, maxValueBrl: undefined, version: '1.1.0' }
    const repo    = makeRepo({ update: jest.fn().mockResolvedValue(updated) })
    const service = new PolicyService(repo)

    const result = await service.updatePolicy('policy-1', TENANT_A, { maxValueBrl: null })
    expect(result.maxValueBrl).toBeUndefined()
  })
})
