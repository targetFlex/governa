import { createHash } from 'node:crypto'

import type { AgentService } from './agent.service'

/**
 * resolvePanelAccess — resolve agentId/subjectToken para listagens feitas
 * via painel administrativo (acesso humano, sem agente de IA nem titular
 * específico associado à consulta).
 *
 * agentId: agente sintético do tenant (getOrCreateSystemAgent), usado só
 * como âncora de FK em audit_events.
 *
 * subjectToken: não é HMAC pseudonimizado com PII_HMAC_KEY (não há titular
 * real por trás de uma listagem geral) — é um marcador determinístico por
 * tenant, só para preencher a coluna NOT NULL e permitir correlacionar
 * essas listagens no audit trail. Nunca usar para comparar contra tokens
 * de titular real (ver shared/crypto/subject-token.ts para esse caso).
 */
export async function resolvePanelAccess(
  agentService: AgentService,
  tenantId: string,
): Promise<{ agentId: string; subjectToken: string }> {
  const systemAgent = await agentService.getOrCreateSystemAgent(tenantId)
  const subjectToken = createHash('sha256')
    .update(`PAINEL_LISTAGEM_GERAL:${tenantId}`)
    .digest('hex')

  return { agentId: systemAgent.id, subjectToken }
}
