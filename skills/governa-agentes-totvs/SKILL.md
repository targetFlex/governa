---
name: governa-agentes-totvs
description: >
  Skill de Governança de Agentes de IA para PMEs no ecossistema TOTVS (Protheus, Fluig, Carol).
  Use este skill sempre que o usuário quiser: (1) projetar ou evoluir a arquitetura do orquestrador
  de governança, (2) definir políticas de autonomia para agentes (consultivo, assistido, autônomo),
  (3) estruturar audit trail LGPD para decisões de agentes, (4) desenhar o workflow âncora de
  atendimento ao cliente integrado ao Protheus, (5) criar ou evoluir o solution doc do MVP,
  (6) definir integrações com TOTVS Store, Fluig BPM ou Carol. Acione também quando o usuário
  mencionar: "agente de atendimento", "governança de IA", "orquestrador", "TOTVS", "Protheus",
  "LGPD e agentes", "política de autonomia", "audit trail de agentes", "Target Flex", ou
  "PME e IA". Este skill encapsula toda a narrativa, decisões de discovery e padrões técnicos
  acumulados nas sessões de discovery do produto.
allowed-tools: Read, Write, Edit, Bash
---

# Governança de Agentes de IA — TOTVS PME

Skill que encapsula o discovery, arquitetura e padrões de implementação do produto de governança
de agentes autônomos voltado para PMEs no ecossistema TOTVS, desenvolvido sob a
**Target Flex Patrimonial** como empresa veículo do produto.

---

## 0. Protocolo de Sessão — LEIA PRIMEIRO (regra crítica)

> Esta seção sobrepõe qualquer outra instrução deste skill. Não pule.

### 0.1 Ao iniciar QUALQUER sessão nova

1. **Primeira ação obrigatória:** listar `docs/reports/` com `Glob` e abrir o arquivo **mais recente por nome** (a convenção `YYYY-MM-DD-sessao-X.Y.md` faz o sort lexicográfico coincidir com o cronológico).
2. **Leia somente esse arquivo.** Não leia `docs/GOVERNA_AGENTES_MVP_SOLUTION.md`, `docs/GOVERNA_AGENTES_MVP_E1.md`, nem qualquer outro doc grande no boot.
3. O report contém o handoff completo da sessão anterior: estado verificado, decisões, itens em aberto, e o que a sessão atual deve atacar.
4. Confirme com o usuário em uma linha: "Li o report de [data] — sessão [X.Y]. Próximo passo: [objetivo]. Confirma?".
5. Só carregue `SOLUTION.md` / `E1.md` / `E2.md` **sob demanda**, em seções específicas que o report indicar (ex.: "Consultar sob demanda: E1.md §1.3").

### 0.2 Ao encerrar uma sessão

Quando o usuário disser "encerrar sessão", "fim da sessão", "fecha a sessão" ou equivalente:

1. Escreva um novo report em `docs/reports/YYYY-MM-DD-sessao-X.Y.md` usando o template em `docs/reports/_template.md`.
2. Token-economy é regra: report **deve caber em poucos KB**. Marcos, não exaustividade. Aponte para arquivos/seções; não duplique conteúdo.
3. Inclua: TL;DR (1-2 linhas), o que mudou (marcos), estado verificado (banco/testes/build), decisões com rationale curto, itens em aberto, e o **handoff explícito** para a próxima sessão (o que atacar, o que consultar sob demanda, o que NÃO tocar).
4. Confirme o conteúdo com o usuário **antes** de encerrar.
5. Faça commit do report junto com qualquer mudança de código pendente.

### 0.3 Por que esta regra existe

Sessões anteriores carregavam `SOLUTION.md` + `E1.md` no boot — consumo de tokens alto e desnecessário. O conhecimento estável vive nos docs de referência; o **estado da arte** vive nos reports. Cada nova sessão herda só do report anterior; o histórico fica preservado por data sem inflar contexto.

### 0.4 Quando NÃO seguir esta regra

- Se o usuário pedir explicitamente "leia o E1 inteiro" / "abra o solution doc" — atenda.
- Se não existir nenhum report em `docs/reports/` (primeiro boot absoluto), informe o usuário e use os docs de referência como entrada inicial, criando o primeiro report ao encerrar.

---

## 1. Contexto do Produto

### 1.1 Problema central

PMEs brasileiras que usam TOTVS (Protheus, Fluig, Carol) estão construindo agentes de IA de
forma isolada — sem orquestração central, sem políticas de autonomia, sem audit trail e sem
conformidade com LGPD. O resultado são "ilhas de decisão" que aumentam risco operacional,
legal e reputacional.

### 1.2 Solução

Um **orquestrador sistêmico** — camada intermediária entre a intenção da empresa e a execução
dos agentes — que oferece:

- Motor de políticas com 3 níveis de autonomia configuráveis sem código
- Checkpoint de aprovação humana para ações críticas
- Audit trail imutável conforme LGPD (Art. 37)
- Inventário de agentes com status em tempo real
- Alertas automáticos por anomalia ou violação de política
- Sandbox de validação antes de produção
- Conectores nativos para Protheus, Fluig e Carol

### 1.3 Posicionamento

| Dimensão | Este produto | Painel Anthropic/OpenAI |
|---|---|---|
| Público-alvo | Gestor operacional de PME | Desenvolvedor/engenheiro |
| Complexidade | Configuração sem código | API + SDK obrigatório |
| Compliance | LGPD nativa, contexto BR | Genérico, foco EUA/EU |
| Integração | TOTVS nativa | REST genérico |
| Pricing | Reais, por agente ativo | Dólar, por token |
| Distribuição | TOTVS Store + direto | Console/Marketplace global |

### 1.4 Empresa veículo

**Target Flex Patrimonial** — produto de tecnologia registrado sob esta empresa.
Ambiente de teste piloto para validação do MVP.

### 1.5 Verticais — sequência de expansão

**MVP (agora):** PMEs TOTVS — qualquer vertical, foco no caso âncora de atendimento.
**Fase 2:** Advocacia (compliance OAB, sigilo profissional, Res. CFJ 215/2021).
**Fase 3:** Imobiliárias e construtoras (CRECI, SPE, contratos de permuta).

> Não expandir verticais antes de 3–5 clientes ativos validando o modelo base.

---

## 2. Arquitetura do Orquestrador

### 2.1 Camadas

```
┌─────────────────────────────────────────────────┐
│  UPSTREAM — fontes TOTVS + externas              │
│  Protheus REST · Fluig BPM · Carol · APIs BR     │
└────────────────┬────────────────────────────────┘
                 │ webhook / REST / polling
┌────────────────▼────────────────────────────────┐
│  GATEWAY DE INTEGRAÇÃO                          │
│  Auth · Rate limiting · Schema validation        │
│  OpenAPI contracts · Error dictionary           │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  NÚCLEO DO ORQUESTRADOR  ← produto MVP          │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ Motor de     │  │ Checkpoint   │             │
│  │ políticas    │  │ humano       │             │
│  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ Audit trail  │  │ Inventário   │             │
│  │ LGPD         │  │ de agentes   │             │
│  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ Sandbox      │  │ Alertas RT   │             │
│  └──────────────┘  └──────────────┘             │
└────────────────┬────────────────────────────────┘
                 │ ToolScope por nível
┌────────────────▼────────────────────────────────┐
│  RUNTIME DE AGENTES                             │
│  Consultivo · Assistido · Autônomo              │
└────────────────┬────────────────────────────────┘
                 │ abstração agnóstica
┌────────────────▼────────────────────────────────┐
│  CAMADA DE MODELOS                              │
│  Claude · OpenAI · Gemini · modelos locais      │
└─────────────────────────────────────────────────┘
```

### 2.2 Módulos do núcleo — detalhes

Leia `references/core-modules.md` para especificações técnicas completas de cada módulo.

### 2.3 Stack técnica

- **Backend:** Node.js + TypeScript (decisão do agente de desenvolvimento — pode ser revisada)
- **ORM/Query:** Prisma + PostgreSQL
- **Queue:** BullMQ (Redis) para checkpoints assíncronos
- **Audit store:** PostgreSQL append-only + S3 Object Lock (arquivo)
- **Hash:** SHA-256 com `pgcrypto` (cadeia encadeada)
- **API:** REST + OpenAPI 3.1
- **Auth:** OAuth 2.0 / JWT — integração SSO TOTVS quando disponível
- **Observabilidade:** OpenTelemetry → SigNoz (self-hosted) ou Sentry

---

## 3. Níveis de Autonomia

### 3.1 Definição técnica por nível

```typescript
enum AutonomyLevel {
  CONSULTIVO = 'consultivo',  // ToolScope: read_* apenas
  ASSISTIDO  = 'assistido',   // ToolScope: read_* + write_* (gated)
  AUTONOMO   = 'autonomo',    // ToolScope: read_* + write_* (dentro de limites)
}
```

### 3.2 ToolScope — como o orquestrador monta o contexto

```typescript
const TOOL_SCOPES = {
  consultivo: (tools) => tools.filter(t => t.name.startsWith('read_')),
  assistido:  (tools) => tools.map(t =>
    t.name.startsWith('write_') ? wrapWithCheckpoint(t) : t
  ),
  autonomo:   (tools, policy) => tools.filter(t =>
    withinPolicyLimits(t, policy)
  ),
}
```

**Princípio:** a restrição é estrutural, não instrucional. O agente consultivo não executa
porque as tools de execução não existem no seu contexto — não porque foi pedido para não usá-las.

### 3.3 Tabela de referência rápida

| Nível | Tools disponíveis | Execução | Aprovação | Caso de uso típico |
|---|---|---|---|---|
| Consultivo | `read_*` apenas | Nunca | N/A | Análise, relatório, diagnóstico |
| Assistido | `read_*` + `write_*` gated | Após aprovação | Obrigatória | Ações de moderado impacto |
| Autônomo | `read_*` + `write_*` limitado | Dentro de limites | Não necessária | Tickets N1, status, FAQ |

---

## 4. Audit Trail LGPD

### 4.1 Estrutura do AuditEvent

```typescript
interface AuditEvent {
  // Rastreio
  trace_id:        string   // UUID v4, gerado no gateway
  span_id:         string   // para rastreio distribuído
  prev_hash:       string   // SHA-256 do evento anterior (gênesis = '0'.repeat(64))
  hash:            string   // SHA-256(this sem o campo hash)

  // Agente
  agent_id:        string
  agent_version:   string
  model_id:        string   // ex: 'claude-sonnet-4-6'
  policy_version:  string

  // Ação
  action:          string   // ex: 'consultar_pedido', 'cancelar_pedido'
  tool_called:     string | null
  input_summary:   string   // resumo sem PII
  outcome:         'executado' | 'bloqueado' | 'aguardando' | 'erro'
  latency_ms:      number

  // LGPD (Art. 37)
  subject_token:   string   // HMAC(CPF/CNPJ, chave_rotacionada) — nunca PII raw
  data_categories: string[] // ex: ['pedidos', 'status_entrega']
  legal_basis:     'legitimate_interest' | 'contract_execution' | 'consent'
  purpose:         string   // finalidade específica
  retention_until: Date     // 5 anos padrão

  // Aprovação humana (se aplicável)
  approver_id:     string | null
  approved_at:     Date | null

  // Timestamp
  created_at:      Date     // imutável após gravação
}
```

### 4.2 Imutabilidade

- Tabela PostgreSQL com `GENERATED ALWAYS AS` para `hash`
- Role de banco sem permissão `UPDATE` ou `DELETE`
- Exportação mensal para S3 com Object Lock (WORM)
- Verificação periódica da cadeia: recalcula hashes sequencialmente

### 4.3 Pseudonimização

- `subject_token = HMAC(identificador, chave_rotacionada_anual)`
- Chave de pseudonimização separada do banco de audit — acesso restrito ao DPO
- Reversível para responder solicitações de titulares (LGPD Art. 18)

---

## 5. Caso de Uso Âncora — Agente de Atendimento Protheus

### 5.1 Descrição

Agente consultivo/assistido integrado ao Protheus que:
1. Recebe tickets de clientes (via webhook Fluig ou API direta)
2. Consulta status de pedido no Protheus
3. Responde ao cliente com informação estruturada
4. Escalona para humano quando fora do escopo configurado

### 5.2 Tools disponíveis (nível consultivo padrão)

```typescript
const ATENDIMENTO_TOOLS = [
  'read_protheus_pedido',      // GET /api/pedidos/{id}
  'read_protheus_cliente',     // GET /api/clientes/{id}
  'read_protheus_nf',          // GET /api/nf/{id}
  'read_politica_atendimento', // base de conhecimento interna
  // write_* bloqueadas no nível consultivo
]
```

### 5.3 Critérios de escalonamento para humano

- Solicitação de cancelamento (ação irreversível)
- Reclamação com menção a processo judicial ou Procon
- Cliente VIP (flag no Protheus)
- Consulta sem resultado no Protheus (pedido não encontrado)
- Confiança do agente < 0.7 na resposta

### 5.4 Piloto — Target Flex Patrimonial

Ambiente sandbox isolado. Dados de teste — não usar dados de clientes reais antes de:
- [ ] DPA (Data Processing Agreement) assinado
- [ ] Política de retenção definida
- [ ] Equipe treinada nos procedimentos de escalonamento

---

## 6. Integrações TOTVS

### 6.1 Protheus

- **Auth:** OAuth 2.0 via TOTVS Fluig Identity (ou Basic em ambientes legados)
- **Endpoint base:** `https://{host}/rest/`
- **Recursos MVP:** `/PEDIDO/`, `/CLIENTE/`, `/NF/`
- **Rate limiting upstream:** 100 req/min por tenant (configurável)
- **Retry policy:** exponential backoff, 3 tentativas, timeout 10s

### 6.2 Fluig

- Webhooks de eventos de processo (novo ticket, aprovação)
- Formulários de aprovação de checkpoint mapeados para processos BPM existentes
- SSO via Fluig Identity para autenticação do painel

### 6.3 Carol (Fase 2)

- Fonte de dados consolidados para agentes com visão cross-sistema
- Evita acesso direto ao banco transacional do Protheus

---

## 7. Referências internas

- `references/core-modules.md` — especificação técnica dos módulos do núcleo
- `references/solution-doc-mvp.md` — documento de escopo do MVP com entregáveis e sessões
- `references/workflow-ancora.md` — esboço funcional do workflow âncora ponta a ponta

---

## 8. Regras de Desenvolvimento

### Princípios inegociáveis

1. **Restrição estrutural antes de instrucional** — ToolScope no contexto, não no prompt
2. **Audit trail em toda decisão** — sem exceção, mesmo em sandbox
3. **PII nunca em log** — subject_token pseudonimizado sempre
4. **Aprovação humana explícita** — nunca inferida por conteúdo de função
5. **Agnóstico ao modelo** — abstração de LLM obrigatória desde o início

### Quando consultar este skill

- Antes de qualquer nova sessão de desenvolvimento do orquestrador
- Ao evoluir políticas de autonomia ou audit trail
- Ao adicionar novo conector TOTVS
- Ao propor expansão para nova vertical

### Atualização do skill

Ao final de cada sessão significativa de discovery ou desenvolvimento, avaliar se decisões
novas devem ser incorporadas. Propor atualização ao usuário antes de gravar.
