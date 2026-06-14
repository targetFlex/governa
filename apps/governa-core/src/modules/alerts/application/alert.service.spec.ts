// ============================================================
// alert.service.spec.ts — TDD para AlertService
//
// Usa InMemoryAlertRepository — sem Prisma, sem I/O.
// Cobertura: listAlerts, listThresholds, upsertThreshold,
//            triggerAlert, updateStatus, subscribe (SSE).
// ============================================================

import { AlertService } from './alert.service'
import { InMemoryAlertRepository } from '../../../../test/fixtures/in-memory-alert.repository'

const TENANT = 'tenant-abc'
const AGENT  = '00000000-0000-0000-0000-000000000001'

function makeService() {
  const repo    = new InMemoryAlertRepository()
  const service = new AlertService(repo)
  return { repo, service }
}

// ─── listAlerts ──────────────────────────────────────────────────────────────

describe('AlertService.listAlerts', () => {
  it('retorna página vazia quando não há alertas', async () => {
    const { service } = makeService()
    const page = await service.listAlerts(TENANT)
    expect(page.data).toEqual([])
    expect(page.total).toBe(0)
  })

  it('lança erro se tenantId vazio', async () => {
    const { service } = makeService()
    await expect(service.listAlerts('')).rejects.toThrow('tenantId é obrigatório')
  })

  it('filtra por agentId', async () => {
    const { service } = makeService()
    await service.triggerAlert({ tenantId: TENANT, agentId: AGENT,  kind: 'TOOL_BLOCKED', severity: 'HIGH', message: 'A' })
    await service.triggerAlert({ tenantId: TENANT, agentId: 'outro', kind: 'ERROR_RATE',  severity: 'LOW',  message: 'B' })

    const page = await service.listAlerts(TENANT, { agentId: AGENT })
    expect(page.data).toHaveLength(1)
    expect(page.data[0].agentId).toBe(AGENT)
  })

  it('filtra por kind', async () => {
    const { service } = makeService()
    await service.triggerAlert({ tenantId: TENANT, agentId: AGENT, kind: 'TOOL_BLOCKED',   severity: 'HIGH', message: 'A' })
    await service.triggerAlert({ tenantId: TENANT, agentId: AGENT, kind: 'CHECKPOINT_EXPIRED', severity: 'HIGH', message: 'B' })

    const page = await service.listAlerts(TENANT, { kind: 'TOOL_BLOCKED' })
    expect(page.data).toHaveLength(1)
    expect(page.data[0].kind).toBe('TOOL_BLOCKED')
  })

  it('filtra por status', async () => {
    const { service } = makeService()
    const alert = await service.triggerAlert({ tenantId: TENANT, agentId: AGENT, kind: 'ERROR_RATE', severity: 'MEDIUM', message: 'X' })
    await service.updateStatus(TENANT, alert.id, 'ACKNOWLEDGED')

    const open = await service.listAlerts(TENANT, { status: 'OPEN' })
    const ack  = await service.listAlerts(TENANT, { status: 'ACKNOWLEDGED' })
    expect(open.data).toHaveLength(0)
    expect(ack.data).toHaveLength(1)
  })

  it('pagina corretamente', async () => {
    const { service } = makeService()
    for (let i = 0; i < 5; i++) {
      await service.triggerAlert({ tenantId: TENANT, agentId: AGENT, kind: 'TOOL_BLOCKED', severity: 'LOW', message: `m${i}` })
    }
    const p1 = await service.listAlerts(TENANT, { page: 1, limit: 3 })
    const p2 = await service.listAlerts(TENANT, { page: 2, limit: 3 })
    expect(p1.data).toHaveLength(3)
    expect(p2.data).toHaveLength(2)
    expect(p1.total).toBe(5)
  })

  it('não retorna alertas de outro tenant', async () => {
    const { service } = makeService()
    await service.triggerAlert({ tenantId: 'outro-tenant', agentId: AGENT, kind: 'TOOL_BLOCKED', severity: 'LOW', message: 'X' })
    const page = await service.listAlerts(TENANT)
    expect(page.data).toHaveLength(0)
  })
})

// ─── triggerAlert ────────────────────────────────────────────────────────────

describe('AlertService.triggerAlert', () => {
  it('cria alerta com status OPEN', async () => {
    const { service } = makeService()
    const alert = await service.triggerAlert({
      tenantId: TENANT,
      agentId:  AGENT,
      kind:     'TOOL_BLOCKED',
      severity: 'HIGH',
      message:  'read_clientes bloqueada por política consultiva',
      metadata: { toolName: 'read_clientes' },
    })

    expect(alert.id).toBeDefined()
    expect(alert.status).toBe('OPEN')
    expect(alert.tenantId).toBe(TENANT)
    expect(alert.metadata).toMatchObject({ toolName: 'read_clientes' })
  })

  it('notifica observadores SSE ao disparar', async () => {
    const { service } = makeService()
    const received: string[] = []
    service.subscribe((a) => received.push(a.id))

    const a1 = await service.triggerAlert({ tenantId: TENANT, agentId: AGENT, kind: 'ERROR_RATE', severity: 'MEDIUM', message: 'X' })
    const a2 = await service.triggerAlert({ tenantId: TENANT, agentId: AGENT, kind: 'TOOL_BLOCKED', severity: 'HIGH', message: 'Y' })

    expect(received).toEqual([a1.id, a2.id])
  })

  it('unsubscribe remove o observador', async () => {
    const { service } = makeService()
    const received: string[] = []
    const unsubscribe = service.subscribe((a) => received.push(a.id))

    await service.triggerAlert({ tenantId: TENANT, agentId: AGENT, kind: 'TOOL_BLOCKED', severity: 'LOW', message: 'A' })
    unsubscribe()
    await service.triggerAlert({ tenantId: TENANT, agentId: AGENT, kind: 'TOOL_BLOCKED', severity: 'LOW', message: 'B' })

    expect(received).toHaveLength(1)
  })

  it('lança erro se tenantId vazio', async () => {
    const { service } = makeService()
    await expect(
      service.triggerAlert({ tenantId: '', agentId: AGENT, kind: 'TOOL_BLOCKED', severity: 'LOW', message: 'X' }),
    ).rejects.toThrow('tenantId é obrigatório')
  })

  it('lança erro se agentId vazio', async () => {
    const { service } = makeService()
    await expect(
      service.triggerAlert({ tenantId: TENANT, agentId: '', kind: 'TOOL_BLOCKED', severity: 'LOW', message: 'X' }),
    ).rejects.toThrow('agentId é obrigatório')
  })
})

// ─── updateStatus ────────────────────────────────────────────────────────────

describe('AlertService.updateStatus', () => {
  it('transiciona OPEN → ACKNOWLEDGED → RESOLVED', async () => {
    const { service } = makeService()
    const alert = await service.triggerAlert({ tenantId: TENANT, agentId: AGENT, kind: 'ERROR_RATE', severity: 'MEDIUM', message: 'X' })

    const ack  = await service.updateStatus(TENANT, alert.id, 'ACKNOWLEDGED')
    expect(ack.status).toBe('ACKNOWLEDGED')

    const res  = await service.updateStatus(TENANT, alert.id, 'RESOLVED')
    expect(res.status).toBe('RESOLVED')
  })

  it('lança erro se tenantId vazio', async () => {
    const { service } = makeService()
    await expect(service.updateStatus('', 'id', 'RESOLVED')).rejects.toThrow('tenantId é obrigatório')
  })

  it('lança erro se id vazio', async () => {
    const { service } = makeService()
    await expect(service.updateStatus(TENANT, '', 'RESOLVED')).rejects.toThrow('id é obrigatório')
  })
})

// ─── thresholds ──────────────────────────────────────────────────────────────

describe('AlertService.listThresholds + upsertThreshold', () => {
  it('retorna 4 kinds com defaults quando nenhum configurado', async () => {
    const { service } = makeService()
    const thresholds = await service.listThresholds(TENANT)
    expect(thresholds).toHaveLength(4)
    const kinds = thresholds.map((t) => t.kind)
    expect(kinds).toContain('TOOL_BLOCKED')
    expect(kinds).toContain('ERROR_RATE')
    expect(kinds).toContain('CHECKPOINT_EXPIRED')
    expect(kinds).toContain('VOLUME_ANOMALY')
  })

  it('upsert atualiza campo enabled', async () => {
    const { service } = makeService()
    const updated = await service.upsertThreshold(TENANT, 'VOLUME_ANOMALY', { enabled: true })
    expect(updated.enabled).toBe(true)

    const list = await service.listThresholds(TENANT)
    const va   = list.find((t) => t.kind === 'VOLUME_ANOMALY')!
    expect(va.enabled).toBe(true)
  })

  it('upsert atualiza errorRatePercent', async () => {
    const { service } = makeService()
    const updated = await service.upsertThreshold(TENANT, 'ERROR_RATE', { errorRatePercent: 25 })
    expect(updated.errorRatePercent).toBe(25)
  })

  it('lança erro se tenantId vazio em listThresholds', async () => {
    const { service } = makeService()
    await expect(service.listThresholds('')).rejects.toThrow('tenantId é obrigatório')
  })

  it('lança erro se tenantId vazio em upsertThreshold', async () => {
    const { service } = makeService()
    await expect(service.upsertThreshold('', 'ERROR_RATE', {})).rejects.toThrow('tenantId é obrigatório')
  })
})
