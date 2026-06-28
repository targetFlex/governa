// ============================================================
// blocked-tool.detector.spec.ts — TDD
//
// Casos de teste para BlockedToolDetector.
//
// Invariantes:
//   - canHandle retorna true APENAS para TOOL_BLOCKED
//   - detect SEMPRE retorna TriggerAlertInput (sem threshold)
//   - severity: HIGH
//   - kind: TOOL_BLOCKED
//   - metadata contém toolName, policyId, reason
// ============================================================

import { BlockedToolDetector } from './blocked-tool.detector'
import type { AlertThreshold } from '../../domain/alert.types'
import type { ToolBlockedEvent, AuditRecordedEvent } from '../../domain/violation-event'

const makeToolBlockedEvent = (overrides: Partial<ToolBlockedEvent> = {}): ToolBlockedEvent => ({
  kind:      'TOOL_BLOCKED',
  tenantId:  'tenant-1',
  agentId:   'agent-1',
  toolName:  'write_database',
  policyId:  'policy-1',
  reason:    'autonomyLevel CONSULTIVO não permite escrita',
  timestamp: new Date('2026-06-14T10:00:00Z'),
  ...overrides,
})

const makeAuditEvent = (): AuditRecordedEvent => ({
  kind:      'AUDIT_RECORDED',
  tenantId:  'tenant-1',
  agentId:   'agent-1',
  outcome:   'BLOQUEADO',
  timestamp: new Date(),
})

const noThresholds: AlertThreshold[] = []

describe('BlockedToolDetector', () => {
  let detector: BlockedToolDetector

  beforeEach(() => {
    detector = new BlockedToolDetector()
  })

  // ── canHandle ─────────────────────────────────────────────────────────────

  it('canHandle retorna true para TOOL_BLOCKED', () => {
    expect(detector.canHandle(makeToolBlockedEvent())).toBe(true)
  })

  it('canHandle retorna false para AUDIT_RECORDED', () => {
    expect(detector.canHandle(makeAuditEvent())).toBe(false)
  })

  // ── detect ────────────────────────────────────────────────────────────────

  it('detect retorna TriggerAlertInput com kind TOOL_BLOCKED e severity HIGH', async () => {
    const event = makeToolBlockedEvent()
    const result = await detector.detect(event, noThresholds)

    expect(result).not.toBeNull()
    expect(result!.kind).toBe('TOOL_BLOCKED')
    expect(result!.severity).toBe('HIGH')
    expect(result!.tenantId).toBe('tenant-1')
    expect(result!.agentId).toBe('agent-1')
  })

  it('detect inclui toolName no metadata', async () => {
    const event = makeToolBlockedEvent({ toolName: 'delete_records' })
    const result = await detector.detect(event, noThresholds)

    expect(result!.metadata?.toolName).toBe('delete_records')
  })

  it('detect inclui policyId e reason no metadata', async () => {
    const event = makeToolBlockedEvent({
      policyId: 'pol-abc',
      reason:   'não permitido por nível CONSULTIVO',
    })
    const result = await detector.detect(event, noThresholds)

    expect(result!.metadata?.policyId).toBe('pol-abc')
    expect(result!.metadata?.reason).toBe('não permitido por nível CONSULTIVO')
  })

  it('detect inclui timestamp no metadata', async () => {
    const ts = new Date('2026-06-14T10:00:00Z')
    const event = makeToolBlockedEvent({ timestamp: ts })
    const result = await detector.detect(event, noThresholds)

    expect(result!.metadata?.blockedAt).toBe(ts.toISOString())
  })

  it('detect gera mensagem descritiva para o operador', async () => {
    const event = makeToolBlockedEvent({
      toolName: 'execute_sql',
      agentId:  'agent-xyz',
    })
    const result = await detector.detect(event, noThresholds)

    expect(result!.message).toContain('execute_sql')
    expect(result!.message).toContain('agent-xyz')
  })

  it('detect ignora thresholds (sempre dispara)', async () => {
    const event = makeToolBlockedEvent()
    const thresholdsDisabled: AlertThreshold[] = [
      {
        id: 'th-1', tenantId: 'tenant-1', kind: 'TOOL_BLOCKED',
        enabled: false,
        errorRatePercent: null, volumePerHour: null,
        checkpointExpiryMin: null, updatedAt: new Date(),
      },
    ]
    // mesmo com threshold disabled, TOOL_BLOCKED sempre dispara
    const result = await detector.detect(event, thresholdsDisabled)
    expect(result).not.toBeNull()
  })
})
