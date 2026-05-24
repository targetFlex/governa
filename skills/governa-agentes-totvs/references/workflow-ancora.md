# Workflow Âncora — Agente de Atendimento Protheus
## Target Flex Patrimonial · MVP · v1

---

## Descrição

Agente de atendimento ao cliente integrado ao Protheus (TOTVS) que opera no modo
**consultivo** por padrão e **assistido** para ações que requerem aprovação humana.

---

## Fluxo ponta a ponta

```
Cliente                Fluig/Canal           Orquestrador          Agente              Protheus
  │                       │                      │                    │                    │
  │── solicita status ──►│                       │                    │                    │
  │   pedido #4821        │── webhook POST ──────►│                    │                    │
  │                       │   {ticket, cliente}   │                    │                    │
  │                       │                      │── monta contexto──►│                    │
  │                       │                      │   ToolScope:        │                    │
  │                       │                      │   [read_pedido,     │                    │
  │                       │                      │    read_cliente,    │                    │
  │                       │                      │    read_politica]   │                    │
  │                       │                      │                    │── read_pedido(4821)►│
  │                       │                      │                    │                    │
  │                       │                      │                    │◄─ {status, valor} ─│
  │                       │                      │◄── recomendação ───│                    │
  │                       │                      │   + audit_event     │                    │
  │                       │◄── resposta ─────────│                    │                    │
  │◄── status do pedido ─│                       │                    │                    │
```

---

## Critérios de escalonamento para humano

```typescript
function shouldEscalate(context: AgentContext): EscalationReason | null {
  // 1. Ação irreversível solicitada
  if (context.intent === 'cancelar' || context.intent === 'estornar') {
    return 'acao_irreversivel'
  }
  // 2. Menção a processo legal
  if (context.message.match(/procon|juizado|processo|advogado/i)) {
    return 'risco_juridico'
  }
  // 3. Cliente VIP (flag no Protheus)
  if (context.cliente?.tier === 'VIP') {
    return 'cliente_vip'
  }
  // 4. Pedido não encontrado
  if (context.pedido === null) {
    return 'pedido_nao_encontrado'
  }
  // 5. Confiança baixa na resposta
  if (context.agent_confidence < 0.70) {
    return 'baixa_confianca'
  }
  return null
}
```

---

## Exemplo de resposta — fluxo consultivo nominal

**Input (ticket):**
```
"Olá, quero saber o status do meu pedido 4821."
```

**Chamadas de tool pelo agente:**
```
read_protheus_pedido("4821")
→ { id: "4821", status: "em_separacao", previsao: "2026-05-19", valor: 1240.00 }

read_protheus_cliente(cliente_id)
→ { tier: "standard", historico: "sem_ocorrencias" }
```

**Resposta gerada (sem execução, modo consultivo):**
```
"Seu pedido #4821, no valor de R$ 1.240,00, está em separação no estoque.
Previsão de envio: 19/05/2026. Assim que sair para entrega, você receberá
um e-mail com o código de rastreio. Posso ajudar com mais alguma coisa?"
```

**AuditEvent gravado:**
```json
{
  "trace_id": "ae-7f3a-...",
  "agent_id": "atendimento-protheus-v1",
  "action": "consultar_pedido",
  "outcome": "executado",
  "tool_called": "read_protheus_pedido",
  "subject_token": "tkn_a7f3c2",
  "data_categories": ["pedidos", "status_entrega"],
  "legal_basis": "contract_execution",
  "purpose": "resposta_a_solicitacao_do_titular",
  "retention_until": "2031-05-17"
}
```

---

## Exemplo — escalonamento para humano (cancelamento)

**Input:**
```
"Quero cancelar meu pedido 4821."
```

**Orquestrador detecta intent `cancelar` → EscalationReason: `acao_irreversivel`**

**Resposta ao cliente:**
```
"Entendido! Vou transferir sua solicitação de cancelamento para nossa equipe,
que entrará em contato em até 2 horas úteis. Seu número de protocolo é #ESC-0042."
```

**Notificação para equipe (via Fluig):**
```
Escalonamento #ESC-0042
Motivo: solicitação de cancelamento (ação irreversível)
Cliente: {nome} | Pedido: #4821 | Valor: R$1.240
Prazo SLA: 2h úteis
```

**AuditEvent gravado:**
```json
{
  "trace_id": "ae-9b2c-...",
  "agent_id": "atendimento-protheus-v1",
  "action": "escalonar_humano",
  "outcome": "executado",
  "tool_called": null,
  "escalation_reason": "acao_irreversivel",
  "subject_token": "tkn_a7f3c2",
  "data_categories": ["pedidos"],
  "legal_basis": "contract_execution",
  "purpose": "escalonamento_por_politica_de_autonomia"
}
```

---

## System prompt base do agente (consultivo)

```
Você é um assistente de atendimento ao cliente da [EMPRESA].
Seu papel é consultar informações sobre pedidos e responder
de forma clara e objetiva.

REGRAS ABSOLUTAS:
- Nunca confirme cancelamentos, reembolsos ou alterações de pedido.
  Para essas solicitações, escalone sempre para a equipe humana.
- Nunca invente informações. Se não encontrar o pedido, diga isso
  claramente e escalone.
- Responda sempre em português brasileiro, com linguagem cordial.
- Não mencione sistemas internos (Protheus, ERP) ao cliente.

ESCALONAMENTO:
Escalone imediatamente quando: cancelamento solicitado, menção a
Procon/processo, cliente não encontrado, pedido não encontrado,
ou quando não tiver certeza da resposta.
```

---

## Sandbox Target Flex — checklist de validação

### Pré-produção
- [ ] 50 interações sintéticas executadas
- [ ] Zero escalonamentos não previstos pelos critérios
- [ ] Audit trail com cadeia de hash íntegra
- [ ] Latência P95 < 3s nas respostas
- [ ] Nenhum PII em log ou audit trail

### Pré-dados reais
- [ ] DPA (Data Processing Agreement) assinado
- [ ] Política de retenção definida e configurada no sistema
- [ ] Equipe de atendimento treinada nos procedimentos de escalonamento
- [ ] Plano de rollback documentado e testado
