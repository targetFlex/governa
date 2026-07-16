// ============================================================
// agente-form.utils.ts
//
// Funções PURAS (sem Angular, testáveis sem TestBed) para:
//   1. Serializar o estado do formulário em preview YAML (read-only).
//   2. Construir o config estruturado (usado por YAML e pelo modo "Pretty").
//   3. Mesclar um template no estado preservando edições manuais.
//
// Nenhuma dessas funções acessa DOM, HttpClient ou signals — recebem
// estado e retornam valores, o que mantém a lógica testável isoladamente.
// ============================================================

import { McpServerRef } from '../../../shared/models/agente.model';

/** Estado relevante do formulário para gerar o preview. */
export interface AgentFormState {
  name:         string;
  description:  string;
  modelId:      string;
  tools:        string[];
  systemPrompt: string;
  skills:       string[];
  mcpServers:   McpServerRef[];
  policyId:     string | null;
  templateId:   string | null;
}

/** Config normalizado do agente — base para YAML e para o resumo Pretty. */
export interface AgentConfig {
  name:        string;
  model:       string;
  description: string;
  system:      string;
  tools:       string[];
  skills:      string[];
  mcpServers:  McpServerRef[];
  policy:      string | null;
  template:    string | null;
}

/**
 * Constrói o config estruturado a partir do estado do formulário.
 * Aplica trim em strings e normaliza vazios para '' / null.
 */
export function buildAgentConfig(state: AgentFormState): AgentConfig {
  return {
    name:        state.name.trim(),
    model:       state.modelId,
    description: state.description.trim(),
    system:      state.systemPrompt.trim(),
    tools:       [...state.tools],
    skills:      [...state.skills],
    mcpServers:  state.mcpServers.map((m) => ({ id: m.id, name: m.name, ...(m.icon ? { icon: m.icon } : {}) })),
    policy:      state.policyId && state.policyId.trim() ? state.policyId.trim() : null,
    template:    state.templateId ?? null,
  };
}

/** Escapa uma string como escalar YAML entre aspas duplas (sempre parseável). */
function yamlString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
  return `"${escaped}"`;
}

/**
 * Serializa o estado do formulário em YAML (bloco somente-leitura do preview).
 *
 * Saída sempre válida/parseável — todas as chaves presentes, strings entre
 * aspas duplas, arrays vazios como `[]`, policy ausente como `null`.
 * As chaves seguem um contrato estável: name, model, description, system,
 * tools, skills, mcp_servers, policy, template.
 */
export function buildAgentYamlPreview(state: AgentFormState): string {
  const cfg = buildAgentConfig(state);
  const lines: string[] = [];

  lines.push(`name: ${yamlString(cfg.name)}`);
  lines.push(`model: ${yamlString(cfg.model)}`);
  lines.push(`description: ${yamlString(cfg.description)}`);
  lines.push(`system: ${yamlString(cfg.system)}`);

  // tools
  if (cfg.tools.length === 0) {
    lines.push('tools: []');
  } else {
    lines.push('tools:');
    for (const t of cfg.tools) lines.push(`  - ${yamlString(t)}`);
  }

  // skills
  if (cfg.skills.length === 0) {
    lines.push('skills: []');
  } else {
    lines.push('skills:');
    for (const s of cfg.skills) lines.push(`  - ${yamlString(s)}`);
  }

  // mcp_servers (lista de mapas)
  if (cfg.mcpServers.length === 0) {
    lines.push('mcp_servers: []');
  } else {
    lines.push('mcp_servers:');
    for (const m of cfg.mcpServers) {
      lines.push(`  - id: ${yamlString(m.id)}`);
      lines.push(`    name: ${yamlString(m.name)}`);
      if (m.icon) lines.push(`    icon: ${yamlString(m.icon)}`);
    }
  }

  lines.push(`policy: ${cfg.policy === null ? 'null' : yamlString(cfg.policy)}`);
  lines.push(`template: ${cfg.template === null ? 'null' : yamlString(cfg.template)}`);

  return lines.join('\n');
}

// ── Merge de template preservando edição manual ─────────────────────────────

/** Campos que um template preenche no formulário. */
export interface TemplateFields {
  formName:        string;
  formDescription: string;
  tools:           string[];
  systemPrompt:    string;
}

/** Compara dois toolsets independentemente da ordem. */
export function isSameToolset(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((t) => setB.has(t));
}

/**
 * Mescla os campos de `next` no estado `current`, preservando qualquer campo
 * que o usuário tenha editado manualmente em relação ao template anterior.
 *
 * Critério (spec §7): sobrescreve APENAS os campos que ainda estão no
 * valor-placeholder do template anterior (`prev`). Se `prev` é null (primeira
 * seleção), todos os campos do template são aplicados.
 */
export function mergeTemplateFields(
  current: TemplateFields,
  prev: TemplateFields | null,
  next: TemplateFields,
): TemplateFields {
  if (prev === null) {
    return {
      formName:        next.formName,
      formDescription: next.formDescription,
      tools:           [...next.tools],
      systemPrompt:    next.systemPrompt,
    };
  }

  const nameUnedited        = current.formName === prev.formName;
  const descriptionUnedited = current.formDescription === prev.formDescription;
  const systemUnedited      = current.systemPrompt === prev.systemPrompt;
  const toolsUnedited       = isSameToolset(current.tools, prev.tools);

  return {
    formName:        nameUnedited        ? next.formName        : current.formName,
    formDescription: descriptionUnedited ? next.formDescription : current.formDescription,
    tools:           toolsUnedited        ? [...next.tools]       : [...current.tools],
    systemPrompt:    systemUnedited       ? next.systemPrompt     : current.systemPrompt,
  };
}
