import { v4 as uuidv4 } from 'uuid'

import type { AuditEventEntity } from '../domain/audit-event.entity'
import type {
  AuditEventInsert,
  AuditEventRepository,
} from '../domain/audit-event-repository.port'
import type { CreateAuditEventInput } from '../domain/create-audit-event-input'

import { InvalidAuditInputError } from './audit.errors'
import { GENESIS_PREV_HASH, computeHash } from './hash-chain'
import { PiiDetector } from './pii-detector'

/**
 * AuditService — caso de uso de gravação de evento de auditoria.
 *
 * Garantias:
 *   - inputSummary livre de PII (gate síncrono via PiiDetector)
 *   - cadeia íntegra (delega serialização ao repositório via appendInChain)
 *   - traceId gerado server-side (UUID v4) — caller não pode forjar
 *   - retentionUntil = createdAt + 5 anos (LGPD art. 16) — não parametrizável
 *   - hash calculado por canonicalJson (determinístico, verificável)
 *
 * Hexagonal: depende SÓ da porta AuditEventRepository + PiiDetector.
 * Sem dep de Prisma, sem Express, sem Date.now ambíguo no hot path.
 */
export interface AuditServiceClock {
  now(): Date
}

const defaultClock: AuditServiceClock = { now: () => new Date() }

const RETENTION_YEARS = 5

export class AuditService {
  constructor(
    private readonly repo:        AuditEventRepository,
    private readonly piiDetector: PiiDetector = new PiiDetector(),
    private readonly clock:       AuditServiceClock = defaultClock,
  ) {}

  async createEvent(input: CreateAuditEventInput): Promise<AuditEventEntity> {
    this.validate(input)
    this.piiDetector.assertClean(input.inputSummary, 'inputSummary')

    const createdAt      = this.clock.now()
    const retentionUntil = this.addYears(createdAt, RETENTION_YEARS)
    const traceId        = uuidv4()

    return this.repo.appendInChain(
      input.tenantId,
      input.agentId,
      (prevHash: string): AuditEventInsert => {
        const safePrevHash = prevHash || GENESIS_PREV_HASH

        const insert: AuditEventInsert = {
          tenantId:         input.tenantId,
          agentId:          input.agentId,
          traceId,
          spanId:           input.spanId,
          prevHash:         safePrevHash,
          hash:             '', // placeholder — sobrescrito abaixo
          action:           input.action,
          toolCalled:       input.toolCalled,
          inputSummary:     input.inputSummary,
          outcome:          input.outcome,
          latencyMs:        input.latencyMs,
          subjectToken:     input.subjectToken,
          dataCategories:   input.dataCategories,
          legalBasis:       input.legalBasis,
          purpose:          input.purpose,
          retentionUntil,
          approverId:       input.approverId,
          escalationReason: input.escalationReason,
        }

        const hash = computeHash({
          tenantId:         insert.tenantId,
          agentId:          insert.agentId,
          traceId:          insert.traceId,
          spanId:           insert.spanId,
          prevHash:         insert.prevHash,
          action:           insert.action,
          toolCalled:       insert.toolCalled,
          inputSummary:     insert.inputSummary,
          outcome:          insert.outcome,
          latencyMs:        insert.latencyMs,
          subjectToken:     insert.subjectToken,
          dataCategories:   insert.dataCategories,
          legalBasis:       insert.legalBasis,
          purpose:          insert.purpose,
          retentionUntil:   insert.retentionUntil,
          approverId:       insert.approverId,
          escalationReason: insert.escalationReason,
        })

        return { ...insert, hash }
      },
    )
  }

  private validate(input: CreateAuditEventInput): void {
    if (!input.tenantId)     throw new InvalidAuditInputError('tenantId',     'obrigatório')
    if (!input.agentId)      throw new InvalidAuditInputError('agentId',      'obrigatório')
    if (!input.action)       throw new InvalidAuditInputError('action',       'obrigatório')
    if (!input.inputSummary) throw new InvalidAuditInputError('inputSummary', 'obrigatório')
    if (!input.subjectToken) throw new InvalidAuditInputError('subjectToken', 'obrigatório')
    if (!input.legalBasis)   throw new InvalidAuditInputError('legalBasis',   'obrigatório (LGPD)')
    if (!input.purpose)      throw new InvalidAuditInputError('purpose',      'obrigatório (LGPD)')
    if (input.latencyMs < 0) throw new InvalidAuditInputError('latencyMs',    'não pode ser negativo')
    if (input.dataCategories.length === 0) {
      throw new InvalidAuditInputError('dataCategories', 'ao menos uma categoria LGPD')
    }
  }

  private addYears(date: Date, years: number): Date {
    const d = new Date(date.getTime())
    // Usa UTC para evitar bug de fuso horário: datas próximas à virada do ano
    // em UTC-3 (Brasil) têm getFullYear() ≠ getUTCFullYear().
    d.setUTCFullYear(d.getUTCFullYear() + years)
    return d
  }
}
