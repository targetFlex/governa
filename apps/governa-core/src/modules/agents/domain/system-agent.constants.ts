/**
 * Marcador de templateId usado pelo agente sistêmico de acesso via painel.
 *
 * As rotas /clientes e /pedidos foram desenhadas para consultas feitas por
 * agentes de IA (exigem agentId+subjectToken — FK de audit_events e
 * pseudonimização LGPD do titular). O painel administrativo (uso humano,
 * sem agente nem titular específico) usa um Agent sintético — um por tenant,
 * criado sob demanda — só para servir de âncora de auditoria dessas
 * listagens gerais. Nunca aparece em GET /agents (ver AgentService.listAgents).
 */
export const PANEL_SYSTEM_AGENT_TEMPLATE_ID = '__system_panel_access__'
