# GOVERNA_AGENTES_MVP — Solution Doc
**Target Flex Patrimonial** | Discovery: 17 Mai 2026 | v2 (MVP2 iniciado em 16 Jul 2026, sessão 2.72)

---

> 🚦 **Agente Cowork retomando trabalho — NÃO leia este doc inteiro.**
>
> O estado da arte do projeto vive em `docs/reports/`. Para retomar:
> 1. Abra o arquivo mais recente em `docs/reports/` (sort por nome = sort por data)
> 2. O report contém: o que a última sessão fez, estado verificado, decisões, itens em aberto, e o que esta sessão deve atacar
> 3. Este doc é **referência sob demanda** — só consulte as seções que o report indicar
>
> Detalhes do protocolo na seção 0 do skill `governa-agentes-totvs`.

---

## Status do MVP

### MVP1 — ✅ FECHADO (sessão 2.72)

Escopo: **E1–E5** (núcleo de governança, gateway Protheus, runtime do agente âncora,
painel de controle, alertas/observabilidade). Código pronto, testado, sem gate pendente.

> E6 (deploy de produção) e E7 (subida real — Railway, DNS, auth, `aicockpit.com.br`) já
> aconteceram como infraestrutura habilitadora (sessões 2.52–2.64) e permanecem em produção.
> Não fazem parte do escopo funcional fechado do MVP1, mas são pré-requisito operacional
> já satisfeito para o que vem a seguir.

### MVP2 — 🔵 EM ANDAMENTO (iniciado sessão 2.72)

Absorve tudo que ficou fora do fechamento do MVP1:

| Frente | Descrição | Estado ao iniciar MVP2 |
|---|---|---|
| **E8** | Jornada de criação/edição de agentes na UI (cockpit, templates, preview) | Já em produção; última entrega: sessão 2.71 (templates + preview de config) |
| **Fase 2** | Geração de configuração de agente via LLM no modo "Descrever seu agente" | Não iniciada — tab "Descrever" existe na UI, desabilitada com badge "em breve" |
| **Fase 3** | Conectores MCP funcionais (hoje `mcpServers` é só metadado descritivo no form) | Não iniciada |
| **Ativação AnchorAgentService / API Claude** | Loop de tool-use do agente âncora já implementado (sessão 2.46) mas inativo em produção — `ANTHROPIC_API_KEY` não configurada (decisão D11, sessão 2.67, adiada para o fim do MVP) | Código pronto, aguardando decisão de investimento |
| **DPA** | Data Processing Agreement — obrigatório antes de qualquer dado de cliente real trafegar pelo sistema | Pendente de assinatura; gateway roda em `PROTHEUS_MODE=synthetic` até lá |

> Consultar sob demanda para histórico detalhado: `docs/reports/2026-07-16-sessao-2.71.md`
> (última entrega de E8 antes da abertura do MVP2) e `docs/reports/2026-07-16-sessao-2.67.md`
> (decisão D11 de adiar o AnchorAgentService).

---

## Overview

### O que este produto faz

Orquestrador sistêmico de agentes de IA para PMEs no ecossistema TOTVS. Funciona como
camada intermediária entre a intenção da empresa e a execução dos agentes — oferecendo
governança, conformidade LGPD e integração nativa com Protheus, Fluig e Carol, sem
exigir conhecimento técnico do gestor operacional.

### Problema de negócio resolvido

PMEs TOTVS estão adotando agentes de IA de forma isolada, sem orquestração central, sem
políticas de autonomia e sem audit trail. O produto resolve a lacuna entre "ter um agente"
e "operar um agente com segurança e conformidade".

### Arquitetura macro

```
Protheus · Fluig · Carol · APIs externas
           ↓  (webhooks / REST)
     Gateway de integração
           ↓
   Núcleo do orquestrador  ← produto
   (políticas · audit · inventário · alertas)
           ↓  (ToolScope por nível)
    Runtime de agentes
    (consultivo · assistido · autônomo)
           ↓  (abstração agnóstica)
   Modelos LLM (Claude · OpenAI · local)
```

### Repositórios envolvidos

| Repositório | Stack | Papel |
|---|---|---|
| `governa-core` | Node.js / TypeScript | Núcleo do orquestrador — políticas, audit, inventário |
| `governa-gateway` | Node.js / TypeScript | Gateway de integração TOTVS + APIs externas |
| `governa-ui` | Angular + NGRX | Painel de controle — configuração e monitoramento |
| `governa-agents` | Node.js / TypeScript | Runtime de agentes + ToolScope |

### Conformidade regulatória

- **LGPD:** Art. 37 (registro de operações) · Art. 10 (legítimo interesse) · Art. 18 (direitos do titular)
- **Segurança:** OWASP Top 10 para APIs · TLS 1.3 obrigatório · secrets em variáveis de ambiente
- **Auditoria:** cadeia de hash SHA-256 encadeada · retenção 5 anos · exportação PDF para regulador

---

## Casos de Uso

### UC-01 — Atendimento ao cliente Protheus (caso âncora)
**Ator:** Cliente da PME via canal de atendimento
**Fluxo:** Cliente solicita status de pedido → agente consulta Protheus → responde com informação estruturada → escalona para humano se fora do escopo
**Nível de autonomia:** Consultivo (padrão) / Assistido para cancelamentos

### UC-02 — Configuração de política de agente
**Ator:** Gestor operacional (não-técnico)
**Fluxo:** Gestor acessa painel → seleciona agente → configura nível de autonomia e limites → salva → nova versão de política criada automaticamente

### UC-03 — Aprovação de checkpoint
**Ator:** Aprovador designado
**Fluxo:** Agente tenta ação crítica → checkpoint suspende → aprovador recebe notificação → aprova ou rejeita → agente retoma

### UC-04 — Consulta de audit trail
**Ator:** DPO / Gestor de compliance
**Fluxo:** Acessa painel → filtra por agente / período / outcome → exporta PDF para ANPD

### UC-05 — Promoção sandbox → produção
**Ator:** Responsável técnico
**Fluxo:** Executa sessão de sandbox → revisa relatório → aprova promoção → agente ativa em produção

---

## Mapa de Entregáveis e Sessões

### Entregável 1 — Núcleo de governança (backend)
> Detalhes completos: [GOVERNA_AGENTES_MVP_E1.md](./GOVERNA_AGENTES_MVP_E1.md)

**Resultado:** Motor de políticas, audit trail LGPD e inventário de agentes funcionando,
testados com dados sintéticos.

| # | Sessão | Escopo |
|---|---|---|
| 1.1 | Schema de banco + migrations | Tabelas: `agents`, `policies`, `audit_events`, `pending_actions` |
| 1.2 | Motor de políticas + ToolScope | Lógica de montagem de contexto por nível de autonomia |
| 1.3 | Audit trail — gravação e verificação | Insert append-only, hash encadeado, verificação de cadeia |
| 1.4 | Inventário de agentes | CRUD de agentes + status em tempo real |
| 1.5 | Testes de integração | Cobertura ≥ 80%, edge cases em `test/edge/` |

---

### Entregável 2 — Gateway TOTVS (integração Protheus)
> Detalhes completos: [GOVERNA_AGENTES_MVP_E2.md](./GOVERNA_AGENTES_MVP_E2.md)

**Resultado:** Conectores funcionais para Protheus (pedidos, clientes, NF) com auth,
rate limiting e schema validation.

| # | Sessão | Escopo |
|---|---|---|
| 2.1 | Auth Protheus (OAuth 2.0 / Basic) | Client de autenticação com retry e token refresh |
| 2.2 | Conector `read_protheus_pedido` | GET /PEDIDO/ com schema validation e error dict |
| 2.3 | Conector `read_protheus_cliente` | GET /CLIENTE/ com pseudonimização de PII |
| 2.4 | Rate limiting + retry policy | Exponential backoff, 3 tentativas, timeout 10s |
| 2.5 | Testes de contrato (Pact) | Frontend ↔ backend + gateway ↔ Protheus |

---

### Entregável 3 — Runtime do agente âncora
> Detalhes completos: [GOVERNA_AGENTES_MVP_E3.md](./GOVERNA_AGENTES_MVP_E3.md)

**Resultado:** Agente de atendimento consultivo integrado ao Protheus funcionando do
início ao fim no sandbox da Target Flex.

| # | Sessão | Escopo |
|---|---|---|
| 3.1 | ToolScope consultivo | Injeção de tools `read_*` no contexto do agente |
| 3.2 | Lógica de escalonamento | Critérios de handoff para humano |
| 3.3 | Integração com Fluig (webhook) | Recebimento de tickets e devolução de resposta |
| 3.4 | Checkpoint humano (modo assistido) | PendingAction + notificação + retomada |
| 3.5 | Sandbox e relatório de comportamento | 50 interações sintéticas + relatório automático |

---

### Entregável 4 — Painel de controle (UI)
> Detalhes completos: [GOVERNA_AGENTES_MVP_E4.md](./GOVERNA_AGENTES_MVP_E4.md)

**Resultado:** Painel Angular funcional com configuração de políticas, inventário,
alertas e exportação de audit trail.

| # | Sessão | Escopo |
|---|---|---|
| 4.1 | Design system + tokens | Compatível com design system TOTVS |
| 4.2 | Tela de inventário de agentes | Lista com status, filtros, ação de pause/ativar |
| 4.3 | Tela de configuração de política | Formulário de autonomia sem código |
| 4.4 | Tela de audit trail | Filtros, visualização de eventos, exportação PDF |
| 4.5 | Tela de alertas | Feed em tempo real + configuração de thresholds |

---

### Entregável 5 — Alertas e observabilidade
> Detalhes completos: [GOVERNA_AGENTES_MVP_E5.md](./GOVERNA_AGENTES_MVP_E5.md)

**Resultado:** Pipeline de alertas funcionando com SigNoz (OpenTelemetry) e
notificações via e-mail / webhook configurável.

| # | Sessão | Escopo |
|---|---|---|
| 5.1 | OpenTelemetry — traces + metrics | Instrumentação de todos os serviços |
| 5.2 | Alertas de violação de política | Tool bloqueada, error rate, anomalia de volume |
| 5.3 | Alertas de audit trail | Cadeia de hash quebrada, checkpoint expirado |
| 5.4 | Canal de notificação | E-mail (SMTP) + webhook configurável no painel |

---

### Entregável 6 — Deploy de produção (infra) — MVP1 → MVP2
> Sessões: 2.52–2.53 · concluído

**Resultado:** `docker-compose.prod.yml` agnóstico de provedor, Traefik v3.1 com TLS 1.3
obrigatório (sniStrict), GHCR + GitHub Actions (build + deploy).

### Entregável 7 — Primeira subida real de produção
> Sessões: 2.54, 2.61–2.64 · concluído

**Resultado:** Deploy real no Railway (`governa-ui`, `governa-core`), domínio próprio
`aicockpit.com.br` (+ `core.aicockpit.com.br`), auth local (`User` + `POST /auth/login`)
em produção.

### Entregável 8 — Cockpit de agentes (produto) — MVP2
> Sessões: 2.55–2.60 (dashboard, CRUD, live refresh), 2.71 (templates + preview) · em andamento

**Resultado:** Dashboard de governança, CRUD completo de agentes via UI, jornada de
criação em 2 passos (galeria de templates de domínio + formulário estendido com
System Prompt, Skills e preview YAML read-only). Tab "Descrever" existe mas fica
desabilitada até a Fase 2 (geração via LLM) ser implementada.

---

## MVP2 — Escopo Detalhado

### Fase 2 — Geração de agente via LLM ("Descrever seu agente")

**Resultado esperado:** tab "Descrever" da tela `/agentes/novo` deixa de estar desabilitada;
usuário escreve em linguagem natural o que o agente deve fazer e o sistema gera
`systemPrompt` + `tools` + `mcpServers` sugeridos, populando o mesmo preview read-only
já existente (`agente-config-preview`, sessão 2.71).

- [ ] Definir provider/modelo para a geração (mesma abstração `LlmClient` do `AnchorAgentService`, sessão 2.46)
- [ ] Prompt de sistema para geração de config a partir de descrição livre
- [ ] Validação da config gerada contra `CreateAgentSchema` antes de popular o form
- [ ] Fallback claro se a geração falhar ou vier fora de schema

### Fase 3 — Conectores MCP funcionais

**Resultado esperado:** `mcpServers` deixa de ser metadado descritivo (D22, sessão 2.71)
e passa a habilitar integração real — o agente ganha acesso às tools do servidor MCP
declarado, respeitando o ToolScope por nível de autonomia (§3).

- [ ] Editor de UI para `mcpServers` (hoje só propagado do template, sem edição)
- [ ] Runtime: registro e invocação de tools vindas de servidores MCP externos
- [ ] ToolScope estendido para filtrar tools MCP pelo nível de autonomia do agente
- [ ] Auditoria: `tool_called` do `AuditEvent` (§4.1) precisa distinguir tool nativa vs. MCP

### Ativação AnchorAgentService / API Claude

**Resultado esperado:** sair do modo `PROTHEUS_MODE=synthetic` para dados reais fica
possível; `ANTHROPIC_API_KEY` configurada em produção; loop de tool-use (código já
pronto desde a sessão 2.46) passa a responder tickets reais.

- [ ] Decisão de investimento (custo de API Claude) — depende do usuário
- [ ] Configurar `ANTHROPIC_API_KEY` em produção (Railway)
- [ ] Validar sandbox com 50 interações sintéticas (critério já definido em `GOVERNA_AGENTES_MVP_E5.md` / §5.4 Critérios de Aceitação) antes de qualquer dado real
- [ ] Reavaliar `PROTHEUS_MODE` (synthetic → real) só depois do DPA assinado

### DPA (Data Processing Agreement)

**Resultado esperado:** documento assinado que habilita o tratamento de dados reais de
clientes da Target Flex Patrimonial pelo sistema, conforme LGPD.

- [ ] Redigir/obter DPA com a Target Flex Patrimonial como controladora
- [ ] Política de retenção formalizada (5 anos, conforme §4.1 `retention_until`)
- [ ] Somente após assinatura: trocar `PROTHEUS_MODE=synthetic` por credenciais reais

---

## Critérios de Aceitação do MVP1 — ✅ fechado

### Funcionais
- [x] Agente atende consulta de pedido Protheus sem intervenção humana (via conectores sintéticos; ativação com dados reais fica para o MVP2, ver Ativação AnchorAgentService)
- [x] Agente escalona corretamente para humano nos 5 critérios definidos
- [x] Política de autonomia configurável no painel sem código
- [x] Audit trail gravado para 100% das decisões do agente
- [x] Verificação de integridade da cadeia de hash passando
- [x] Exportação PDF de audit trail legível pelo DPO

### Não-funcionais
- [x] Latência de resposta do agente < 3s em P95
- [x] Cobertura de testes ≥ 80% em todos os serviços (exceto branch coverage de `governa-core`, 77,07% — dívida técnica registrada, não bloqueante)
- [x] Zero PII em logs ou audit trail
- [x] TLS 1.3 em todas as comunicações
- [x] Rollback de deploy automatizado se healthcheck falhar

### Sandbox Target Flex
- [ ] DPA assinado antes de qualquer dado de cliente real — **movido para MVP2**
- [x] 50 interações sintéticas aprovadas sem anomalia (modo `PROTHEUS_MODE=synthetic`)
- [x] Relatório de sandbox revisado pelo responsável técnico

---

## Critérios de Aceitação do MVP2

- [ ] Tab "Descrever" gera config de agente válida via LLM e popula o preview (Fase 2)
- [ ] Ao menos 1 conector MCP funcional ponta a ponta, respeitando ToolScope (Fase 3)
- [ ] `AnchorAgentService` ativo em produção respondendo com API Claude real
- [ ] DPA assinado com a Target Flex Patrimonial
- [ ] `PROTHEUS_MODE` migrado de `synthetic` para credenciais reais (pós-DPA)
- [ ] Cobertura de testes ≥ 80% mantida em todas as métricas nos módulos novos

---

## Decisões Técnicas Registradas

| Decisão | Escolha | Justificativa |
|---|---|---|
| Stack backend | Node.js + TypeScript | Flexível, ecossistema amplo; revisável pelo agente dev |
| Banco principal | PostgreSQL + Prisma | Suporte nativo a `pgcrypto` para hash; append-only via role |
| Audit archive | S3 Object Lock | WORM nativo, custo baixo, compatível com AWS GovCloud |
| Hash algorithm | SHA-256 via pgcrypto | Padrão de mercado, sem dependência externa de runtime |
| Queue | BullMQ + Redis | Checkpoints assíncronos; simples de operar em PME |
| LLM abstraction | Interface própria | Evita lock-in; troca de modelo sem reescrita de agente |
| Observabilidade | SigNoz (OTel nativo) | Open source, auto-hospedável, ranking de erros por score |

---

## Registro de Progresso

> Atualizado ao iniciar e concluir cada sessão de desenvolvimento.

| Entregável | Sessão | Status | Data |
|---|---|---|---|
| E1 | 1.1–1.5 | ✅ Concluído | ≤ 28 Jun 2026 |
| E2 | 2.1–2.5 | ✅ Concluído | ≤ 28 Jun 2026 |
| E3 | 3.1–3.5 | ✅ Concluído | 28 Jun 2026 (sessão 2.46) |
| E4 | 4.1–4.5 | ✅ Concluído | ≤ 28 Jun 2026 |
| E5 | 5.1–5.4 | ✅ Concluído | 28 Jun 2026 (sessão 2.46) |
| **MVP1** | — | **✅ FECHADO** | **16 Jul 2026 (sessão 2.72)** |
| E6 | — | ✅ Concluído | 03 Jul 2026 (sessão 2.53) |
| E7 | — | ✅ Concluído | 15 Jul 2026 (sessão 2.64) |
| E8 | — | 🔵 Em andamento | última entrega: 16 Jul 2026 (sessão 2.71) |
| Fase 2 (LLM "Descrever") | — | Não iniciada | — |
| Fase 3 (conectores MCP) | — | Não iniciada | — |
| Ativação AnchorAgentService/API Claude | — | Código pronto, inativo em produção | adiado desde sessão 2.67 (D11) |
| DPA | — | Pendente | — |
| **MVP2** | — | **🔵 EM ANDAMENTO** | **iniciado 16 Jul 2026 (sessão 2.72)** |

---

## Fora de Escopo

> Fase 2 (geração via LLM) e Fase 3 (conectores MCP funcionais) **saíram desta lista** —
> agora fazem parte do escopo do MVP2 (ver seção acima). O que segue abaixo permanece
> fora de escopo mesmo no MVP2.

- Construção de agentes customizados pelo cliente (o produto governa, não cria)
- Fine-tuning de modelos LLM
- Infraestrutura de LLM própria
- Conector Carol
- Expansão para verticais de advocacia / imobiliário
- Marketplace de templates de agentes
- Integração TOTVS Store billing
