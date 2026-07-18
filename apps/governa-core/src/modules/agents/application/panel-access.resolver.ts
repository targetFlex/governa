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

/**
 * resolvePanelSubjectAccess — mesma ideia de resolvePanelAccess, mas para
 * uma consulta do painel sobre um titular ESPECÍFICO (ex: reidentificação
 * de um cliente para exibição humana).
 *
 * subjectToken aqui é determinístico por (tenant, clienteId, loja) — não é
 * o HMAC "oficial" do titular via PII_HMAC_KEY (ver shared/crypto/subject-
 * token.ts para esse caso, usado quando um agente real já conhece o
 * titular). Serve só para correlacionar no audit trail quem foi
 * reidentificado, sem depender de PII_HMAC_KEY (hoje ausente em produção).
 */
export async function resolvePanelSubjectAccess(
  agentService: AgentService,
  tenantId: string,
  clienteId: string,
  loja: string,
): Promise<{ agentId: string; subjectToken: string }> {
  const systemAgent = await agentService.getOrCreateSystemAgent(tenantId)
  const subjectToken = createHash('sha256')
    .update(`PAINEL_REIDENTIFICACAO:${tenantId}:${clienteId}:${loja}`)
    .digest('hex')

  return { agentId: systemAgent.id, subjectToken }
}
