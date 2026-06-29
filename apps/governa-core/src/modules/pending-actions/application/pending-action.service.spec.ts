import { PendingActionService, PendingActionNotFoundError, PendingActionAlreadyResolvedError } from './pending-action.service'
import type { PendingActionRepository } from '../domain/pending-action-repository.port'
import type { PendingAction } from '../domain/pending-action.entity'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT = 'tenant-1'
const AGENT  = 'agent-1'

function makeAction(overrides: Partial<PendingAction> = {}): PendingAction {
  return {
    id:         'pa-1',
    tenantId:   TENANT,
    agentId:    AGENT,
    toolName:   'USER_REQUESTED',
    payload: {
      ticketId:          'ticket-001',
      sessionId:         'sess-1',
      userMessage:       'Quero falar com humano',
      agentReply:        '',
      escalationReason:  'USER_REQUESTED',
      escalationSummary: 'Usuário pediu atendimento humano.',
    },
    status:     'PENDING',
    approverId: null,
    expiresAt:  new Date(Date.now() + 86400000),
    createdAt:  new Date(),
    resolvedAt: null,
    ...overrides,
  }
}

function makeRepo(overrides: Partial<PendingActionRepository> = {}): jest.Mocked<PendingActionRepository> {
  return {
    create:              jest.fn().mockResolvedValue(makeAction()),
    findById:            jest.fn().mockResolvedValue(makeAction()),
    findPendingByTenant: jest.fn().mockResolvedValue([makeAction()]),
    approve:             jest.fn().mockResolvedValue(makeAction({ status: 'APPROVED', approverId: 'op-1', resolvedAt: new Date() })),
    reject:              jest.fn().mockResolvedValue(makeAction({ status: 'REJECTED', approverId: 'op-1', resolvedAt: new Date() })),
    expireStale:         jest.fn().mockResolvedValue(0),
    ...overrides,
  } as jest.Mocked<PendingActionRepository>
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('PendingActionService', () => {

  describe('create()', () => {
    it('When called, Then delegates to repository with default expiresAt', async () => {
      const repo = makeRepo()
      const svc  = new PendingActionService(repo)
      const before = Date.now()

      await svc.create({
        tenantId: TENANT, agentId: AGENT,
        toolName: 'USER_REQUESTED',
        payload:  makeAction().payload,
      })

      const call = repo.create.mock.calls[0]![0]
      expect(call.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 23 * 3600 * 1000)
    })

    it('When expiresAt provided, Then uses it', async () => {
      const repo = makeRepo()
      const svc  = new PendingActionService(repo)
      const exp  = new Date(Date.now() + 3600_000)

      await svc.create({ tenantId: TENANT, agentId: AGENT, toolName: 'X', payload: makeAction().payload, expiresAt: exp })

      expect(repo.create.mock.calls[0]![0].expiresAt).toEqual(exp)
    })
  })

  describe('findById()', () => {
    it('When found, Then returns action', async () => {
      const repo = makeRepo()
      const svc  = new PendingActionService(repo)
      const result = await svc.findById('pa-1', TENANT)
      expect(result.id).toBe('pa-1')
    })

    it('When not found, Then throws PendingActionNotFoundError', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) })
      const svc  = new PendingActionService(repo)
      await expect(svc.findById('missing', TENANT)).rejects.toBeInstanceOf(PendingActionNotFoundError)
    })
  })

  describe('approve()', () => {
    it('When PENDING, Then marks as APPROVED and returns action', async () => {
      const repo = makeRepo()
      const svc  = new PendingActionService(repo)
      const result = await svc.approve('pa-1', TENANT, { approverId: 'op-1' })
      expect(result.status).toBe('APPROVED')
      expect(repo.approve).toHaveBeenCalledWith('pa-1', TENANT, { approverId: 'op-1' })
    })

    it('When already APPROVED, Then throws PendingActionAlreadyResolvedError', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeAction({ status: 'APPROVED' })) })
      const svc  = new PendingActionService(repo)
      await expect(svc.approve('pa-1', TENANT, { approverId: 'op-1' })).rejects.toBeInstanceOf(PendingActionAlreadyResolvedError)
    })

    it('When callbackUrl present, Then retomada callback is fired', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
      const actionWithCallback = makeAction({
        status: 'APPROVED', approverId: 'op-1', resolvedAt: new Date(),
        payload: { ...makeAction().payload, callbackUrl: 'https://fluig.example.com/resume' },
      })
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(makeAction({ payload: { ...makeAction().payload, callbackUrl: 'https://fluig.example.com/resume' } })),
        approve:  jest.fn().mockResolvedValue(actionWithCallback),
      })
      const svc = new PendingActionService(repo)

      await svc.approve('pa-1', TENANT, { approverId: 'op-1', responseMessage: 'Aprovado.' })
      await new Promise(r => setTimeout(r, 10))

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://fluig.example.com/resume',
        expect.objectContaining({ method: 'POST' }),
      )
      fetchSpy.mockRestore()
    })

    it('When no callbackUrl, Then no fetch is called', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch')
      const svc = new PendingActionService(makeRepo())
      await svc.approve('pa-1', TENANT, { approverId: 'op-1' })
      await Promise.resolve()
      expect(fetchSpy).not.toHaveBeenCalled()
      fetchSpy.mockRestore()
    })
  })

  describe('reject()', () => {
    it('When PENDING, Then marks as REJECTED', async () => {
      const repo   = makeRepo()
      const svc    = new PendingActionService(repo)
      const result = await svc.reject('pa-1', TENANT, 'op-1')
      expect(result.status).toBe('REJECTED')
    })

    it('When already REJECTED, Then throws PendingActionAlreadyResolvedError', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeAction({ status: 'REJECTED' })) })
      const svc  = new PendingActionService(repo)
      await expect(svc.reject('pa-1', TENANT, 'op-1')).rejects.toBeInstanceOf(PendingActionAlreadyResolvedError)
    })
  })

  describe('expireStale()', () => {
    it('When called, Then delegates to repo.expireStale with current date', async () => {
      const repo = makeRepo({ expireStale: jest.fn().mockResolvedValue(3) })
      const svc  = new PendingActionService(repo)
      const count = await svc.expireStale()
      expect(count).toBe(3)
      expect(repo.expireStale).toHaveBeenCalledWith(expect.any(Date))
    })
  })
})
