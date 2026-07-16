// ============================================================
// agente-templates.data.ts
//
// Galeria de templates de agente do domínio TOTVS/Protheus (E8).
// SEM lógica — apenas dados. Cada template é um ponto de partida:
// preenche nome sugerido, descrição, ferramentas e system prompt,
// tudo editável antes do submit.
//
// O template "Agente em branco" (id BLANK_TEMPLATE_ID) representa
// criação do zero — ao submeter, templateId é enviado como null.
// ============================================================

import { McpServerRef } from '../../../shared/models/agente.model';

export interface AgentTemplate {
  /** Identificador estável — enviado como templateId (exceto o "em branco"). */
  id:              string;
  /** Título exibido no card. */
  name:            string;
  /** Subtítulo curto do card. */
  description:     string;
  /** Emoji ilustrativo (metadado visual — não é integração). */
  icon:            string;
  /** Nome sugerido do agente (placeholder inicial do campo Nome). */
  formName:        string;
  /** Descrição pré-preenchida. */
  formDescription: string;
  /** Ferramentas pré-selecionadas (values de TOOLS no form). */
  tools:           string[];
  /** System prompt base — ponto de partida editável. */
  systemPrompt:    string;
  /**
   * Conectores MCP implicados pelo template (metadado descritivo nesta fase —
   * sem integração funcional). Ex.: templates que leem o Protheus declaram o
   * conector "Protheus REST".
   */
  mcpServers:      McpServerRef[];
}

/** id do template "Agente em branco" — submete templateId = null. */
export const BLANK_TEMPLATE_ID = 'em-branco';

/** Conector Protheus REST — metadado usado pelos templates que leem o Protheus. */
const PROTHEUS_REST: McpServerRef = { id: 'protheus-rest', name: 'Protheus REST', icon: 'protheus' };

export const TEMPLATES: readonly AgentTemplate[] = [
  {
    id:              BLANK_TEMPLATE_ID,
    name:            'Agente em branco',
    description:     'Começa do zero, apenas com o toolset core.',
    icon:            '📄',
    formName:        '',
    formDescription: '',
    tools:           [],
    systemPrompt:    '',
    mcpServers:      [],
  },
  {
    id:              'consulta-pedidos',
    name:            'Consulta de Pedidos',
    description:     'Responde status e detalhes de pedidos.',
    icon:            '📦',
    formName:        'Agente de Consulta de Pedidos',
    formDescription: 'Responde dúvidas de status e detalhes de pedido consultando o Protheus.',
    tools:           ['read_protheus_pedido'],
    systemPrompt:
      'Você é um agente que consulta pedidos no Protheus e responde de forma objetiva. ' +
      'Sempre confirme o número do pedido antes de responder e nunca invente dados que não venham do Protheus.',
    mcpServers:      [PROTHEUS_REST],
  },
  {
    id:              'atendimento-cliente',
    name:            'Atendimento ao Cliente',
    description:     'Consulta dados de cliente e políticas internas.',
    icon:            '🎧',
    formName:        'Agente de Atendimento ao Cliente',
    formDescription: 'Atende dúvidas de clientes consultando cadastro e políticas internas.',
    tools:           ['read_protheus_cliente', 'read_politica_atendimento'],
    systemPrompt:
      'Você atende dúvidas de clientes consultando cadastro e políticas internas. ' +
      'Seja cordial, objetivo e respeite sempre as políticas de atendimento vigentes.',
    mcpServers:      [PROTHEUS_REST],
  },
  {
    id:              'triagem-nf',
    name:            'Triagem de Nota Fiscal',
    description:     'Consulta NFs emitidas e sinaliza divergências.',
    icon:            '🧾',
    formName:        'Agente de Triagem de Nota Fiscal',
    formDescription: 'Audita notas fiscais emitidas buscando inconsistências e divergências.',
    tools:           ['read_protheus_nf'],
    systemPrompt:
      'Você audita notas fiscais emitidas buscando inconsistências. ' +
      'Aponte divergências de valor, imposto e cadastro de forma clara e priorizada.',
    mcpServers:      [PROTHEUS_REST],
  },
  {
    id:              'monitor-politica',
    name:            'Monitor de Política',
    description:     'Consulta e explica políticas internas.',
    icon:            '📚',
    formName:        'Agente Monitor de Política',
    formDescription: 'Explica políticas internas da empresa de forma clara e acessível.',
    tools:           ['read_politica_atendimento'],
    systemPrompt:
      'Você explica políticas internas da empresa de forma clara. ' +
      'Cite a política de origem e traduza o juridiquês para linguagem simples.',
    mcpServers:      [],
  },
  {
    id:              'escalonamento',
    name:            'Escalonamento',
    description:     'Encaminha casos complexos; alta autonomia.',
    icon:            '🚨',
    formName:        'Agente de Escalonamento',
    formDescription: 'Triagem de casos e decisão entre resolver ou escalonar para um humano.',
    tools:           ['read_protheus_pedido', 'read_protheus_cliente', 'read_protheus_nf', 'read_politica_atendimento'],
    systemPrompt:
      'Você faz a triagem de casos e decide se resolve ou escalona para um humano. ' +
      'Quando o caso exceder sua alçada ou envolver risco, escale com um resumo objetivo do contexto.',
    mcpServers:      [PROTHEUS_REST],
  },
];
