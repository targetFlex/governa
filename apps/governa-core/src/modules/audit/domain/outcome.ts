/**
 * Outcome — desfecho da intenção do agente registrada no audit trail.
 * Replica enum Prisma `Outcome` como tipo de domínio puro.
 *
 *  - EXECUTADO:  tool foi invocada e completou com sucesso
 *  - BLOQUEADO:  policy proibiu a ação (não chegou na tool)
 *  - AGUARDANDO: ASSISTIDO/AUTONOMO com aprovação pendente
 *  - ESCALADO:   agente decidiu pedir ajuda humana (sem violação)
 *  - ERRO:       falha técnica durante execução (timeout, exception)
 */
export type Outcome =
  | 'EXECUTADO'
  | 'BLOQUEADO'
  | 'AGUARDANDO'
  | 'ESCALADO'
  | 'ERRO'

export const OUTCOMES: readonly Outcome[] = [
  'EXECUTADO',
  'BLOQUEADO',
  'AGUARDANDO',
  'ESCALADO',
  'ERRO',
] as const
