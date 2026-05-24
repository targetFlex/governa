# Módulos do Núcleo — Especificação Técnica

## Motor de Políticas

Responsável por montar o `ToolScope` de cada agente antes de cada chamada ao LLM.

```typescript
interface AgentPolicy {
  agent_id:        string
  autonomy_level:  AutonomyLevel
  allowed_actions: string[]       // prefixos ou nomes exatos
  limits: {
    max_value_brl?: number        // para ações financeiras
    time_window?:   string        // ex: '24h' para cancelamentos
    customer_tiers?: string[]     // ex: ['standard'] — exclui VIP
  }
  approvers:       string[]       // user_ids para checkpoints
  active:          boolean
  version:         string         // semver da política
}
```

Configurado via painel sem código. Versionado — alterações geram nova versão, não sobrescrevem.

---

## Checkpoint Humano

Intercepta tools `write_*` no modo assistido antes da execução.

**Fluxo:**
1. Agente chama `write_protheus_cancelar_pedido(payload)`
2. Orquestrador intercepta → cria `PendingAction` no banco
3. Notifica aprovadores via webhook (Fluig form, e-mail, Slack)
4. Suspende execução (resposta assíncrona à tool)
5. Aprovador responde → orquestrador retoma e entrega resultado ao agente

**Para o agente:** a tool simplesmente "demorou para responder" — comportamento opaco e correto.

```typescript
interface PendingAction {
  id:           string
  agent_id:     string
  tool_name:    string
  payload:      object        // sanitizado, sem PII
  status:       'pending' | 'approved' | 'rejected' | 'expired'
  approver_id:  string | null
  expires_at:   Date          // SLA de aprovação (padrão: 4h)
  created_at:   Date
}
```

---

## Inventário de Agentes

Registro central de todos os agentes ativos no tenant.

```typescript
interface AgentRecord {
  id:            string
  name:          string        // ex: 'atendimento-protheus-v1'
  description:   string
  owner_id:      string        // responsável técnico
  policy_id:     string        // política ativa
  status:        'active' | 'sandbox' | 'deprecated' | 'paused'
  model:         string        // LLM utilizado
  tools:         string[]      // tools no escopo atual
  created_at:    Date
  last_active:   Date
  call_count_7d: number        // para dimensionamento
  error_rate_7d: number        // para alertas
}
```

Visível no painel como lista com filtros por status, responsável e nível de autonomia.

---

## Alertas em Tempo Real

Dispara notificações quando thresholds são excedidos.

| Evento | Condição padrão | Canal padrão |
|---|---|---|
| Tool bloqueada | Agente tenta tool fora do escopo | E-mail + webhook |
| Error rate alto | > 5% em janela de 1h | E-mail + webhook |
| Checkpoint expirado | PendingAction sem resposta em 4h | E-mail |
| Cadeia de hash quebrada | Verificação periódica falha | Alerta crítico |
| Anomalia de volume | > 3x a média de 7d em 1h | E-mail + webhook |

Configurável por agente e por tenant no painel.

---

## Sandbox

Ambiente isolado para validação antes de produção.

- Banco de dados separado com dados sintéticos
- Tools do Protheus apontam para ambiente de homologação TOTVS
- Audit trail gravado normalmente (para validar a funcionalidade)
- Rollback automático disponível para ações `write_*`
- Relatório de comportamento gerado ao fim de cada sessão de sandbox

**Critério de promoção para produção:**
- [ ] Mínimo 50 interações sem comportamento anômalo
- [ ] Zero escalonamentos inesperados
- [ ] Audit trail íntegro (verificação de hash OK)
- [ ] Aprovação do responsável técnico
