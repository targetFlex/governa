import type { PrismaClient } from '@prisma/client'

import { PrismaAgentRepository } from '../../src/modules/policies/infrastructure/prisma-agent.repository'

/**
 * Contract test do adapter Prisma — sem subir Postgres.
 *
 * Garante o invariante hexagonal mais crítico (preferência #1 do usuário):
 *   "Nenhuma query Prisma sem filtro tenantId"
 * Se alguém um dia remover o `tenantId` do where, este teste falha.
 *
 * Também valida o mapeamento Decimal → number e tratamento de nullable.
 */

interface PrismaMock {
  agent: {
    findFirst: jest.Mock
  }
}

function mockPrisma(): { client: PrismaClient; mock: PrismaMock } {
  const mock: PrismaMock = {
    agent: { findFirst: jest.fn() },
  }
  return { client: mock as unknown as PrismaClient, mock }
}

describe('PrismaAgentRepository — adapter contract', () => {
  it('Edge: where clause SEMPRE contém id, tenantId e status not DEPRECATED', async () => {
    const { client, mock } = mockPrisma()
    mock.agent.findFirst.mockResolvedValue(null)

    const repo = new PrismaAgentRepository(client)
    await repo.findActiveForTenant('agent-1', 'tenant-1')

    expect(mock.agent.findFirst).toHaveBeenCalledWith({
      where: {
        id:       'agent-1',
        tenantId: 'tenant-1',
        status:   { not: 'DEPRECATED' },
      },
      include: { policy: true },
    })
  })

  it('Edge: retorna null quando Prisma retorna null', async () => {
    const { client, mock } = mockPrisma()
    mock.agent.findFirst.mockResolvedValue(null)

    const repo = new PrismaAgentRepository(client)
    const result = await repo.findActiveForTenant('x', 'y')

    expect(result).toBeNull()
  })

  it('Edge: maps Prisma row to AgentEntity preservando policy completa', async () => {
    const { client, mock } = mockPrisma()
    mock.agent.findFirst.mockResolvedValue({
      id:       'a1',
      tenantId: 't1',
      status:   'ACTIVE',
      policy: {
        id:             'pol1',
        tenantId:       't1',
        name:           'P',
        autonomyLevel:  'ASSISTIDO',
        allowedActions: ['write_x'],
        maxValueBrl:    { toString: () => '1500.50' }, // Prisma Decimal-like
        timeWindowH:    24,
        approvers:      ['u1'],
        version:        '2.0.0',
      },
    })

    const repo = new PrismaAgentRepository(client)
    const entity = await repo.findActiveForTenant('a1', 't1')

    expect(entity).not.toBeNull()
    expect(entity!.id).toBe('a1')
    expect(entity!.tenantId).toBe('t1')
    expect(entity!.status).toBe('ACTIVE')
    expect(entity!.policy).toEqual({
      id:             'pol1',
      tenantId:       't1',
      name:           'P',
      autonomyLevel:  'ASSISTIDO',
      allowedActions: ['write_x'],
      maxValueBrl:    1500.5,
      timeWindowH:    24,
      approvers:      ['u1'],
      version:        '2.0.0',
    })
  })

  it('Edge: agent sem policy mapeia policy como null (não quebra)', async () => {
    const { client, mock } = mockPrisma()
    mock.agent.findFirst.mockResolvedValue({
      id: 'a2', tenantId: 't1', status: 'ACTIVE', policy: null,
    })

    const repo = new PrismaAgentRepository(client)
    const entity = await repo.findActiveForTenant('a2', 't1')

    expect(entity!.policy).toBeNull()
  })

  it('Edge: policy com maxValueBrl null mapeia para undefined', async () => {
    const { client, mock } = mockPrisma()
    mock.agent.findFirst.mockResolvedValue({
      id: 'a3', tenantId: 't1', status: 'ACTIVE',
      policy: {
        id: 'p3', tenantId: 't1', name: 'P3',
        autonomyLevel: 'CONSULTIVO',
        allowedActions: [],
        maxValueBrl: null,
        timeWindowH: null,
        approvers: [],
        version: '1.0.0',
      },
    })

    const repo = new PrismaAgentRepository(client)
    const entity = await repo.findActiveForTenant('a3', 't1')

    expect(entity!.policy!.maxValueBrl).toBeUndefined()
    expect(entity!.policy!.timeWindowH).toBeUndefined()
  })
})
