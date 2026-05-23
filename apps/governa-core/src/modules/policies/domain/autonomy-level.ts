/**
 * Nível de autonomia do agente — replica o enum Prisma `AutonomyLevel`
 * como tipo de domínio puro (sem dep de @prisma/client no core domain).
 *
 * - CONSULTIVO: somente leitura (read_*), sem aprovação humana
 * - ASSISTIDO:  leitura + escrita gated (write_* via PendingAction + approver)
 * - AUTONOMO:   leitura + escrita direta (write_* dentro dos limites da policy)
 */
export type AutonomyLevel = 'CONSULTIVO' | 'ASSISTIDO' | 'AUTONOMO'

export const AUTONOMY_LEVELS: readonly AutonomyLevel[] = [
  'CONSULTIVO',
  'ASSISTIDO',
  'AUTONOMO',
] as const
