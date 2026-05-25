import type { AuditEventEntity } from './audit-event.entity'

/**
 * Dados para INSERT — espelha o AuditEventEntity menos os campos
 * que o banco gera (id default uuid, createdAt default now()).
 */
export type AuditEventInsert = Omit<AuditEventEntity, 'id' | 'createdAt'>

/**
 * AuditEventRepository — PORTA (hexagonal).
 *
 * Invariantes que TODA implementação deve sustentar:
 *   - filtra SEMPRE por tenantId em toda query (isolamento LGPD)
 *   - garantia de serialização da gravação por (tenantId, agentId) —
 *     usar advisory lock, SERIALIZABLE ou equivalente — para que
 *     `lastHashFor()` + `create()` no AuditService formem cadeia íntegra
 *     mesmo sob concorrência
 *
 * O método `appendInChain` encapsula a sequência atômica (ler último +
 * inserir novo) que o service não deve precisar coordenar.
 */
export interface AuditEventRepository {
  /**
   * Última hash conhecida para o par (tenantId, agentId).
   * Retorna `null` se nenhum evento existe para esse agente.
   *
   * Útil para verificação read-only (AuditVerifier). Para gravação,
   * use `appendInChain` que serializa leitura + escrita atomicamente.
   */
  lastHashFor(tenantId: string, agentId: string): Promise<string | null>

  /**
   * Append atômico: dentro do lock por agente, executa o `compute`
   * passando o último hash conhecido, recebe o registro completo a
   * inserir, e persiste. Retorna o evento gravado.
   *
   * O service usa este método para garantir que prevHash do novo
   * evento é sempre o hash do último realmente persistido — sem race.
   */
  appendInChain(
    tenantId: string,
    agentId:  string,
    compute:  (prevHash: string) => AuditEventInsert,
  ): Promise<AuditEventEntity>

  /**
   * Itera eventos em ordem cronológica (createdAt asc) para
   * verificação da cadeia. Implementação deve paginar por motivo
   * de performance — `batchSize` é hint para o cursor.
   */
  iterateChain(
    tenantId:  string,
    agentId:   string,
    batchSize: number,
  ): AsyncIterable<AuditEventEntity>
}
