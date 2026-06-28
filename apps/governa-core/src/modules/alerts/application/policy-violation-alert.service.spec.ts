// ============================================================
// policy-violation-alert.service.spec.ts — TDD
//
// Casos de teste para PolicyViolationAlertService.
//
// Responsabilidade do serviço:
//   - Orquestra os detectores registrados
//   - Carrega thresholds do tenant via AlertRepository
//   - Dispara alertas via AlertService para cada input retornado
//   - Retorna a lista de alerts criados
// ============================================================

import { PolicyViolationAlertService } from './policy-violation-alert.service'
import type { ViolationDetector }      from '../domain/violation-detector.port'
import type { AlertRepository }        from '../domain/alert-repository.port'
import type { AlertService, TriggerAlertInput } from './alert.service'
import type { AlertThreshold, Alert }  from '../domain/alert.types'
import type { ViolationEvent }         from '../domain/violation-event'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id:        'alert-1',
  tenantId:  'tenant-1',
  agentId:   'agent-1',
  kind:      'TOOL_BLOCKED',
  severity:  'HIGH',
  status:    'OPEN',
  message:   'Tool bloqueada',
  metadata:  {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeThresholds = (): AlertThreshold[] => [
  {
    id: 'th-1', tenantId: 'tenant-1', kind: 'TOOL_BLOCKED',
    enabled: true, errorRatePercent: null, volumePerHour: null,
    checkpointExpiryMin: null, updatedAt: new Date(),
  },
  {
    id: 'th-2', tenantId: 'tenant-1', kind: 'ERROR_RATE',
    enabled: true, errorRatePercent: 10, volumePerHour: null,
    checkpointExpiryMin: null, updatedAt: new Date(),
  },
]

const makeToolBlockedEvent = (): ViolationEvent => ({
  kind:      'TOOL_BLOCKED',
  tenantId:  'tenant-1',
  agentId:   'agent-1',
  toolName:  'write_db',
  policyId:  'pol-1',
  reason:    'CONSULTIVO não permite escrita',
  timestamp: new Date(),
})

const makeAuditEvent = (): ViolationEvent => ({
  kind:      'AUDIT_RECORDED',
  tenantId:  'tenant-1',
  agentId:   'agent-1',
  outcome:   'ERRO',
  timestamp: new Date(),
})

// ─── Mocks ────────────────────────────────────────────────────────────────────

const makeMockAlertRepo = (thresholds: AlertThreshold[] = makeThresholds()): jest.Mocked<Pick<AlertRepository, 'listThresholds'>> => ({
  listThresholds: jest.fn().mockResolvedValue(thresholds),
})

const makeMockAlertService = (alert: Alert = makeAlert()): jest.Mocked<Pick<AlertService, 'triggerAlert'>> => ({
  triggerAlert: jest.fn().mockResolvedValue(alert),
})

const makeMockDetector = (
  handles: boolean,
  result: TriggerAlertInput | null,
): jest.Mocked<ViolationDetector> => ({
  canHandle: jest.fn().mockReturnValue(handles),
  detect:    jest.fn().mockResolvedValue(result),
})

const makeTriggerInput = (overrides: Partial<TriggerAlertInput> = {}): TriggerAlertInput => ({
  tenantId: 'tenant-1',
  agentId:  'agent-1',
  kind:     'TOOL_BLOCKED',
  severity: 'HIGH',
  message:  'Tool write_db bloqueada',
  metadata: {},
  ...overrides,
})

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('PolicyViolationAlertService', () => {
  let alertRepo:    ReturnType<typeof makeMockAlertRepo>
  let alertService: ReturnType<typeof makeMockAlertService>

  beforeEach(() => {
    alertRepo    = makeMockAlertRepo()
    alertService = makeMockAlertService()
  })

  // ── sem detectores ────────────────────────────────────────────────────────

  it('retorna [] quando não há detectores registrados', async () => {
    const svc = new PolicyViolationAlertService(
      alertService as unknown as AlertService,
      alertRepo    as unknown as AlertRepository,
      [],
    )
    const result = await svc.evaluate(makeToolBlockedEvent())
    expect(result).toEqual([])
  })

  // ── detector não aplica ───────────────────────────────────────────────────

  it('não dispara alerta quando detector.canHandle retorna false', async () => {
    const detector = makeMockDetector(false, makeTriggerInput())
    const svc = new PolicyViolationAlertService(
      alertService as unknown as AlertService,
      alertRepo    as unknown as AlertRepository,
      [detector],
    )
    await svc.evaluate(makeToolBlockedEvent())

    expect(detector.detect).not.toHaveBeenCalled()
    expect(alertService.triggerAlert).not.toHaveBeenCalled()
  })

  // ── detector retorna null ─────────────────────────────────────────────────

  it('não dispara alerta quando detector.detect retorna null', async () => {
    const detector = makeMockDetector(true, null)
    const svc = new PolicyViolationAlertService(
      alertService as unknown as AlertService,
      alertRepo    as unknown as AlertRepository,
      [detector],
    )
    const result = await svc.evaluate(makeToolBlockedEvent())

    expect(alertService.triggerAlert).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  // ── detector dispara alerta ───────────────────────────────────────────────

  it('dispara alerta quando detector.detect retorna TriggerAlertInput', async () => {
    const input    = makeTriggerInput()
    const detector = makeMockDetector(true, input)
    const alert    = makeAlert()
    alertService   = makeMockAlertService(alert)

    const svc = new PolicyViolationAlertService(
      alertService as unknown as AlertService,
      alertRepo    as unknown as AlertRepository,
      [detector],
    )
    const result = await svc.evaluate(makeToolBlockedEvent())

    expect(alertService.triggerAlert).toHaveBeenCalledWith(input)
    expect(result).toEqual([alert])
  })

  // ── múltiplos detectores ──────────────────────────────────────────────────

  it('executa múltiplos detectores e agrega alertas', async () => {
    const input1 = makeTriggerInput({ kind: 'TOOL_BLOCKED' })
    const input2 = makeTriggerInput({ kind: 'ERROR_RATE' })
    const alert1 = makeAlert({ kind: 'TOOL_BLOCKED' })
    const alert2 = makeAlert({ id: 'alert-2', kind: 'ERROR_RATE' })

    const d1 = makeMockDetector(true, input1)
    const d2 = makeMockDetector(true, input2)
    alertService.triggerAlert
      .mockResolvedValueOnce(alert1)
      .mockResolvedValueOnce(alert2)

    const svc = new PolicyViolationAlertService(
      alertService as unknown as AlertService,
      alertRepo    as unknown as AlertRepository,
      [d1, d2],
    )
    const result = await svc.evaluate(makeAuditEvent())

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(alert1)
    expect(result[1]).toEqual(alert2)
  })

  // ── thresholds passados ao detector ──────────────────────────────────────

  it('carrega thresholds do tenant e passa ao detector', async () => {
    const thresholds = makeThresholds()
    alertRepo = makeMockAlertRepo(thresholds)

    const detector = makeMockDetector(true, null)
    const svc = new PolicyViolationAlertService(
      alertService as unknown as AlertService,
      alertRepo    as unknown as AlertRepository,
      [detector],
    )
    const event = makeToolBlockedEvent()
    await svc.evaluate(event)

    expect(alertRepo.listThresholds).toHaveBeenCalledWith('tenant-1')
    expect(detector.detect).toHaveBeenCalledWith(event, thresholds)
  })

  // ── carrega thresholds apenas uma vez por evaluate() ─────────────────────

  it('carrega thresholds apenas uma vez por evaluate(), mesmo com múltiplos detectores', async () => {
    const d1 = makeMockDetector(true, null)
    const d2 = makeMockDetector(true, null)

    const svc = new PolicyViolationAlertService(
      alertService as unknown as AlertService,
      alertRepo    as unknown as AlertRepository,
      [d1, d2],
    )
    await svc.evaluate(makeToolBlockedEvent())

    expect(alertRepo.listThresholds).toHaveBeenCalledTimes(1)
  })
})
