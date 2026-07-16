// ============================================================
// agente-form.utils.spec.ts
//
// Testes das funções puras (sem TestBed):
//   - buildAgentConfig       → normalização do estado
//   - buildAgentYamlPreview  → YAML parseável (Gherkin cenário 3)
//   - mergeTemplateFields    → preserva edição manual (Gherkin cenário 2)
//   - isSameToolset          → comparação de toolsets
// ============================================================

import * as yaml from 'js-yaml';
import {
  AgentFormState,
  buildAgentConfig,
  buildAgentYamlPreview,
  mergeTemplateFields,
  isSameToolset,
  TemplateFields,
} from './agente-form.utils';

const baseState = (overrides: Partial<AgentFormState> = {}): AgentFormState => ({
  name:         'Agente de Pedidos',
  description:  'Consulta pedidos',
  modelId:      'claude-sonnet-5',
  tools:        ['read_protheus_pedido'],
  systemPrompt: 'Você consulta pedidos.',
  skills:       [],
  mcpServers:   [{ id: 'protheus-rest', name: 'Protheus REST' }],
  policyId:     null,
  templateId:   'consulta-pedidos',
  ...overrides,
});

// ── buildAgentConfig ─────────────────────────────────────────

describe('buildAgentConfig', () => {

  it('normaliza strings (trim) e mapeia campos', () => {
    const cfg = buildAgentConfig(baseState({ name: '  Agente  ', description: '  d  ' }));
    expect(cfg.name).toBe('Agente');
    expect(cfg.description).toBe('d');
    expect(cfg.model).toBe('claude-sonnet-5');
    expect(cfg.tools).toEqual(['read_protheus_pedido']);
  });

  it('policy vazio/whitespace vira null', () => {
    expect(buildAgentConfig(baseState({ policyId: '   ' })).policy).toBeNull();
    expect(buildAgentConfig(baseState({ policyId: 'p-1' })).policy).toBe('p-1');
  });

});

// ── buildAgentYamlPreview ────────────────────────────────────

describe('buildAgentYamlPreview', () => {

  it('gera YAML parseável com as chaves name, model e tools (Gherkin cenário 3)', () => {
    const out = buildAgentYamlPreview(baseState());
    const parsed = yaml.load(out) as Record<string, unknown>;

    expect(parsed).toHaveProperty('name');
    expect(parsed).toHaveProperty('model');
    expect(parsed).toHaveProperty('tools');
    expect(parsed['name']).toBe('Agente de Pedidos');
    expect(parsed['model']).toBe('claude-sonnet-5');
    expect(parsed['tools']).toEqual(['read_protheus_pedido']);
  });

  it('arrays vazios são serializados como [] e policy ausente como null', () => {
    const out = buildAgentYamlPreview(baseState({ tools: [], skills: [], mcpServers: [], policyId: null }));
    const parsed = yaml.load(out) as Record<string, unknown>;

    expect(parsed['tools']).toEqual([]);
    expect(parsed['skills']).toEqual([]);
    expect(parsed['mcp_servers']).toEqual([]);
    expect(parsed['policy']).toBeNull();
  });

  it('serializa tools e skills não-vazios como listas parseáveis', () => {
    const out = buildAgentYamlPreview(baseState({
      tools:  ['read_protheus_pedido', 'read_protheus_nf'],
      skills: ['resumo-executivo', 'traducao'],
    }));
    const parsed = yaml.load(out) as { tools: string[]; skills: string[] };

    expect(parsed.tools).toEqual(['read_protheus_pedido', 'read_protheus_nf']);
    expect(parsed.skills).toEqual(['resumo-executivo', 'traducao']);
  });

  it('mcp_servers é serializado como lista de mapas parseável', () => {
    const out = buildAgentYamlPreview(baseState({
      mcpServers: [{ id: 'protheus-rest', name: 'Protheus REST', icon: 'protheus' }],
    }));
    const parsed = yaml.load(out) as { mcp_servers: Array<Record<string, string>> };

    expect(parsed.mcp_servers).toEqual([
      { id: 'protheus-rest', name: 'Protheus REST', icon: 'protheus' },
    ]);
  });

  it('escapa aspas e quebras de linha mantendo o YAML válido', () => {
    const out = buildAgentYamlPreview(baseState({
      systemPrompt: 'Linha 1\nLinha "2" com aspas',
      name:         'Nome com "aspas"',
    }));
    const parsed = yaml.load(out) as Record<string, string>;

    expect(parsed['system']).toBe('Linha 1\nLinha "2" com aspas');
    expect(parsed['name']).toBe('Nome com "aspas"');
  });

});

// ── isSameToolset ────────────────────────────────────────────

describe('isSameToolset', () => {

  it('true independentemente da ordem', () => {
    expect(isSameToolset(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  it('false quando difere', () => {
    expect(isSameToolset(['a'], ['a', 'b'])).toBe(false);
    expect(isSameToolset(['a', 'b'], ['a', 'c'])).toBe(false);
  });

});

// ── mergeTemplateFields ──────────────────────────────────────

describe('mergeTemplateFields', () => {

  const tplA: TemplateFields = {
    formName:        'Agente A',
    formDescription: 'desc A',
    tools:           ['read_protheus_pedido'],
    systemPrompt:    'prompt A',
  };
  const tplB: TemplateFields = {
    formName:        'Agente B',
    formDescription: 'desc B',
    tools:           ['read_protheus_cliente'],
    systemPrompt:    'prompt B',
  };

  it('sem template anterior aplica todos os campos do novo', () => {
    const current: TemplateFields = { formName: 'x', formDescription: 'y', tools: [], systemPrompt: 'z' };
    const merged = mergeTemplateFields(current, null, tplA);
    expect(merged).toEqual(tplA);
  });

  it('preserva campos editados manualmente e sobrescreve os não editados', () => {
    // Estado atual = tplA, mas usuário editou o nome
    const current: TemplateFields = { ...tplA, formName: 'Meu Nome Custom' };
    const merged = mergeTemplateFields(current, tplA, tplB);

    expect(merged.formName).toBe('Meu Nome Custom');       // editado → preservado
    expect(merged.formDescription).toBe('desc B');          // não editado → novo
    expect(merged.tools).toEqual(['read_protheus_cliente']); // não editado → novo
    expect(merged.systemPrompt).toBe('prompt B');            // não editado → novo
  });

  it('preserva toolset editado manualmente', () => {
    const current: TemplateFields = { ...tplA, tools: ['read_protheus_nf'] };
    const merged = mergeTemplateFields(current, tplA, tplB);
    expect(merged.tools).toEqual(['read_protheus_nf']);
  });

});
