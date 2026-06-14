# GOVERNA_AGENTES_MVP — Solution Doc
**Target Flex Patrimonial** | Discovery: 17 Mai 2026 | v1

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

## Critérios de Aceitação do MVP

### Funcionais
- [ ] Agente atende consulta de pedido Protheus sem intervenção humana
- [ ] Agente escalona corretamente para humano nos 5 critérios definidos
- [ ] Política de autonomia configurável no painel sem código
- [ ] Audit trail gravado para 100% das decisões do agente
- [ ] Verificação de integridade da cadeia de hash passando
- [ ] Exportação PDF de audit trail legível pelo DPO

### Não-funcionais
- [ ] Latência de resposta do agente < 3s em P95
- [ ] Cobertura de testes ≥ 80% em todos os serviços
- [ ] Zero PII em logs ou audit trail
- [ ] TLS 1.3 em todas as comunicações
- [ ] Rollback de deploy automatizado se healthcheck falhar

### Sandbox Target Flex
- [ ] DPA assinado antes de qualquer dado de cliente real
- [ ] 50 interações sintéticas aprovadas sem anomalia
- [ ] Relatório de sandbox revisado pelo responsável técnico

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
| E1 | 1.1–1.5 | Pendente | — |
| E2 | 2.1–2.5 | Pendente | — |
| E3 | 3.1–3.5 | Pendente | — |
| E4 | 4.1–4.5 | Pendente | — |
| E5 | 5.1–5.4 | Pendente | — |

---

## Fora de Escopo (MVP)

- Construção de agentes customizados pelo cliente (o produto governa, não cria)
- Fine-tuning de modelos LLM
- Infraestrutura de LLM própria
- Conector Carol (Fase 2)
- Expansão para verticais de advocacia / imobiliário (Fase 3)
- Marketplace de templates de agentes (Fase 2)
- Integração TOTVS Store billing (Fase 2)
