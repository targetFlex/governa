// ============================================================
// error-rate.detector.spec.ts — TDD
//
// Casos de teste para ErrorRateDetector.
//
// Regras de negócio:
//   - Avalia apenas AUDIT_RECORDED
//   - Janela padrão: 5 minutos
//   - Threshold default: 10% (configurável via AlertThreshold)
//   - Dispara se: (erros / total) * 100 >= threshold
//   - Não dispara se: threshold desabilitado
//   - Não dispara se: total < MIN_SAMPLES (5)
//   - severity: MEDIUM se rate < 30%, HIGH se rate < 60%, CRITICAL se >= 60%
// ============================================================

import { ErrorRateDetector } from './error-rate.detector'
import type { AlertThreshold } from '../../domain/alert.types'
import type { AuditRecordedEvent, ToolBlockedEvent } from '../../domain/violation-event'
import type { AuditEventRepository } from '../../../audit/domain/audit-event-repository.port'

const makeAuditEvent = (outcome: AuditRecordedEvent['outcome'] = 'ERRO'): AuditRecordedEvent => ({
  kind:      'AUDIT_RECORDED',
  tenantId:  'tenant-1',
  agentId:   'agent-1',
  outcome,
  timestamp: new Date('2026-06-14T10:00:00Z'),
})

const makeToolBlockedEvent = (): ToolBlockedEvent => ({
  kind:      'TOOL_BLOCKED',
  tenantId:  'tenant-1',
  agentId:   'agent-1',
  toolName:  'write_db',
  policyId:  'pol-1',
  reason:    'negado',
  timestamp: new Date(),
})

const makeThreshold = (overrides: Partial<AlertThreshold> = {}): AlertThreshold => ({
  id:                   'th-1',
  tenantId:             'tenant-1',
  kind:                 'ERROR_RATE',
  enabled:              true,
  errorRatePercent:     10,
  volumePerHour:        null,
  checkpointExpiryMin:  null,
  updatedAt:            new Date(),
  ...overrides,
})

const makeAuditRepo = (total: number, errors: number): jest.Mocked<Pick<AuditEventRepository, 'countSince' | 'countByOutcomeSince'>> => ({
  countSince:           jest.fn().mockResolvedValue(total),
  countByOutcomeSince:  jest.fn().mockResolvedValue(errors),
})

describe('ErrorRateDetector', () => {
  let detector: ErrorRateDetector
  let auditRepo: ReturnType<typeof makeAuditRepo>

  beforeEach(() => {
    auditRepo = makeAuditRepo(10, 2)  // 20% error rate por default
    detector = new ErrorRateDetector(auditRepo as unknown as AuditEventRepository)
  })

  // ── canHandle ─────────────────────────────────────────────────────────────

  it('canHandle retorna true para AUDIT_RECORDED', () => {
    expect(detector.canHandle(makeAuditEvent())).toBe(true)
  })

  it('canHandle retorna false para TOOL_BLOCKED', () => {
    expect(detector.canHandle(makeToolBlockedEvent())).toBe(false)
  })

  // ── detect: dispara alerta ────────────────────────────────────────────────

  it('dispara alerta quando error rate supera threshold', async () => {
    // 20% > 10% threshold
    auditRepo = makeAuditRepo(10, 2)
    detector = new ErrorRateDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])

    expect(result).not.toBeNull()
    expect(result!.kind).toBe('ERROR_RATE')
    expect(result!.tenantId).toBe('tenant-1')
    expect(result!.agentId).toBe('agent-1')
  })

  it('severity MEDIUM quando error rate entre 10% e 29%', async () => {
    auditRepo = makeAuditRepo(10, 2)  // 20%
    detector = new ErrorRateDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])
    expect(result!.severity).toBe('MEDIUM')
  })

  it('severity HIGH quando error rate entre 30% e 59%', async () => {
    auditRepo = makeAuditRepo(10, 4)  // 40%
    detector = new ErrorRateDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])
    expect(result!.severity).toBe('HIGH')
  })

  it('severity CRITICAL quando error rate >= 60%', async () => {
    auditRepo = makeAuditRepo(10, 7)  // 70%
    detector = new ErrorRateDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])
    expect(result!.severity).toBe('CRITICAL')
  })

  it('inclui errorRate no metadata', async () => {
    auditRepo = makeAuditRepo(10, 2)  // 20%
    detector = new ErrorRateDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])
    expect(result!.metadata?.errorRatePercent).toBe(20)
    expect(result!.metadata?.totalEvents).toBe(10)
    expect(result!.metadata?.errorEvents).toBe(2)
  })

  // ── detect: não dispara ───────────────────────────────────────────────────

  it('retorna null quando error rate está abaixo do threshold', async () => {
    auditRepo = makeAuditRepo(10, 0)  // 0%
    detector = new ErrorRateDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])
    expect(result).toBeNull()
  })

  it('retorna null quando threshold desabilitado', async () => {
    auditRepo = makeAuditRepo(10, 5)  // 50% — superaria threshold
    detector = new ErrorRateDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold({ enabled: false })])
    expect(result).toBeNull()
  })

  it('retorna null quando amostras insuficientes (< 5)', async () => {
    auditRepo = makeAuditRepo(3, 2)  // 66% mas só 3 samples
    detector = new ErrorRateDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])
    expect(result).toBeNull()
  })

  it('retorna null quando não há threshold configurado para ERROR_RATE', async () => {
    auditRepo = makeAuditRepo(10, 5)
    detector = new ErrorRateDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [])
    expect(result).toBeNull()
  })

  // ── integração com auditRepo ──────────────────────────────────────────────

  it('consulta countSince com janela de 5 minutos antes do timestamp', async () => {
    const ts = new Date('2026-06-14T10:05:00Z')
    const event = makeAuditEvent()
    event.timestamp = ts

    auditRepo = makeAuditRepo(10, 2)
    detector = new ErrorRateDetector(auditRepo as unknown as AuditEventRepository)
    await detector.detect(event, [makeThreshold()])

    const fromArg: Date = (auditRepo.countSince as jest.Mock).mock.calls[0][2]
    const diffMs = ts.getTime() - fromArg.getTime()
    expect(diffMs).toBe(5 * 60 * 1000)  // exatamente 5 minutos
  })
})
