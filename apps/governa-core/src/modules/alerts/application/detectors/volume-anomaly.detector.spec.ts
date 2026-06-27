// ============================================================
// volume-anomaly.detector.spec.ts — TDD
//
// Casos de teste para VolumeAnomalyDetector.
//
// Regras de negócio:
//   - Avalia apenas AUDIT_RECORDED
//   - Janela: última 1 hora
//   - Threshold default: 500 decisões/hora (configurável)
//   - Dispara se: totalDecisoes >= volumePerHour
//   - Não dispara se: threshold desabilitado (DEFAULT: VOLUME_ANOMALY disabled=false)
//   - severity: MEDIUM se volume < 2x threshold, HIGH se < 5x, CRITICAL se >= 5x
// ============================================================

import { VolumeAnomalyDetector } from './volume-anomaly.detector'
import type { AlertThreshold }   from '../../domain/alert.types'
import type { AuditRecordedEvent, ToolBlockedEvent } from '../../domain/violation-event'
import type { AuditEventRepository } from '../../../audit/domain/audit-event-repository.port'

const makeAuditEvent = (): AuditRecordedEvent => ({
  kind:      'AUDIT_RECORDED',
  tenantId:  'tenant-1',
  agentId:   'agent-1',
  outcome:   'EXECUTADO',
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
  id:                   'th-vol',
  tenantId:             'tenant-1',
  kind:                 'VOLUME_ANOMALY',
  enabled:              true,
  errorRatePercent:     null,
  volumePerHour:        500,
  checkpointExpiryMin:  null,
  updatedAt:            new Date(),
  ...overrides,
})

const makeAuditRepo = (count: number): jest.Mocked<Pick<AuditEventRepository, 'countSince'>> => ({
  countSince: jest.fn().mockResolvedValue(count),
})

describe('VolumeAnomalyDetector', () => {
  let detector: VolumeAnomalyDetector
  let auditRepo: ReturnType<typeof makeAuditRepo>

  beforeEach(() => {
    auditRepo = makeAuditRepo(100)
    detector = new VolumeAnomalyDetector(auditRepo as unknown as AuditEventRepository)
  })

  // ── canHandle ─────────────────────────────────────────────────────────────

  it('canHandle retorna true para AUDIT_RECORDED', () => {
    expect(detector.canHandle(makeAuditEvent())).toBe(true)
  })

  it('canHandle retorna false para TOOL_BLOCKED', () => {
    expect(detector.canHandle(makeToolBlockedEvent())).toBe(false)
  })

  // ── detect: dispara alerta ────────────────────────────────────────────────

  it('dispara alerta quando volume >= threshold', async () => {
    auditRepo = makeAuditRepo(500)  // exatamente no threshold
    detector = new VolumeAnomalyDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])

    expect(result).not.toBeNull()
    expect(result!.kind).toBe('VOLUME_ANOMALY')
    expect(result!.tenantId).toBe('tenant-1')
    expect(result!.agentId).toBe('agent-1')
  })

  it('severity MEDIUM quando volume entre 1x e 2x threshold', async () => {
    auditRepo = makeAuditRepo(600)  // 1.2x
    detector = new VolumeAnomalyDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])
    expect(result!.severity).toBe('MEDIUM')
  })

  it('severity HIGH quando volume entre 2x e 5x threshold', async () => {
    auditRepo = makeAuditRepo(1500)  // 3x
    detector = new VolumeAnomalyDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])
    expect(result!.severity).toBe('HIGH')
  })

  it('severity CRITICAL quando volume >= 5x threshold', async () => {
    auditRepo = makeAuditRepo(2500)  // 5x
    detector = new VolumeAnomalyDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])
    expect(result!.severity).toBe('CRITICAL')
  })

  it('inclui volumePerHour e totalDecisions no metadata', async () => {
    auditRepo = makeAuditRepo(750)
    detector = new VolumeAnomalyDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])
    expect(result!.metadata?.totalDecisionsLastHour).toBe(750)
    expect(result!.metadata?.thresholdVolumePerHour).toBe(500)
  })

  // ── detect: não dispara ───────────────────────────────────────────────────

  it('retorna null quando volume abaixo do threshold', async () => {
    auditRepo = makeAuditRepo(499)
    detector = new VolumeAnomalyDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold()])
    expect(result).toBeNull()
  })

  it('retorna null quando threshold desabilitado', async () => {
    auditRepo = makeAuditRepo(9999)  // muito acima
    detector = new VolumeAnomalyDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold({ enabled: false })])
    expect(result).toBeNull()
  })

  it('retorna null quando não há threshold configurado para VOLUME_ANOMALY', async () => {
    auditRepo = makeAuditRepo(9999)
    detector = new VolumeAnomalyDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [])
    expect(result).toBeNull()
  })

  it('retorna null quando volumePerHour não configurado no threshold', async () => {
    auditRepo = makeAuditRepo(9999)
    detector = new VolumeAnomalyDetector(auditRepo as unknown as AuditEventRepository)

    const result = await detector.detect(makeAuditEvent(), [makeThreshold({ volumePerHour: null })])
    expect(result).toBeNull()
  })

  // ── integração com auditRepo ──────────────────────────────────────────────

  it('consulta countSince com janela de 1 hora antes do timestamp', async () => {
    const ts = new Date('2026-06-14T10:00:00Z')
    const event = { ...makeAuditEvent(), timestamp: ts }

    auditRepo = makeAuditRepo(600)
    detector = new VolumeAnomalyDetector(auditRepo as unknown as AuditEventRepository)
    await detector.detect(event, [makeThreshold()])

    const fromArg: Date = (auditRepo.countSince as jest.Mock).mock.calls[0][2]
    const diffMs = ts.getTime() - fromArg.getTime()
    expect(diffMs).toBe(60 * 60 * 1000)  // exatamente 1 hora
  })
})
