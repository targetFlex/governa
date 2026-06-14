# GOVERNA_AGENTES_MVP — Entregável 1
## Núcleo de governança (backend)
**Target Flex Patrimonial · MVP · v1**

---

## Objetivo do entregável

Motor de políticas, audit trail LGPD e inventário de agentes funcionando,
testados com dados sintéticos. Ao final deste entregável, o orquestrador
consegue receber uma intenção de agente, aplicar a política correta,
montar o ToolScope e gravar o AuditEvent com hash encadeado.

---

## Sessão 1.1 — Schema de banco + migrations ✅ CONCLUÍDA

### Status
Concluída em 18/05/2026. Migration aplicada:
`20260518011539_init_multi_tenant_schema`

### O que foi entregue
- Tabelas: `tenants`, `agents`, `policies`, `audit_events`, `pending_actions`
- Isolamento multi-tenant por `tenant_id` (row-level)
- Role `governa_app` com `audit_events` append-only (INSERT+SELECT apenas)
- Seed: Target Flex Patrimonial como tenant padrão (`target-flex-dev`)
- Agente semente: `agent-atendimento-v1` (status SANDBOX, nível CONSULTIVO)
- Política semente: `policy-atendimento-consultivo`

### Verificação
```sql
-- Deve retornar:
-- tenants: 1, agents: 1, policies: 1, audit_events: 0, pending_actions: 0
SELECT 'tenants' AS tabela, COUNT(*)::int AS registros FROM tenants
UNION ALL SELECT 'agents',          COUNT(*)::int FROM agents
UNION ALL SELECT 'policies',        COUNT(*)::int FROM policies
UNION ALL SELECT 'audit_events',    COUNT(*)::int FROM audit_events
UNION ALL SELECT 'pending_actions', COUNT(*)::int FROM pending_actions;

-- Role append-only deve retornar apenas INSERT e SELECT:
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'governa_app' AND table_name = 'audit_events'
ORDER BY privilege_type;
```

---

## Sessão 1.2 — Motor de políticas + ToolScope

### Objetivo
Implementar o `PolicyEngine` — módulo central que, dado um `agent_id` e
um `tenant_id`, carrega a política ativa, monta o `ToolScope` correto e
retorna o contexto pronto para ser enviado ao LLM.

### Arquivos a criar

```
apps/governa-core/src/
  modules/
    policies/
      policy.engine.ts        ← lógica principal
      policy.engine.spec.ts   ← testes unitários
      tool-scope.builder.ts   ← monta lista de tools por nível
      tool-scope.builder.spec.ts
    agents/
      agent.repository.ts     ← queries Prisma de agents + policies
      agent.repository.spec.ts
  shared/
    middleware/
      tenant.middleware.ts    ← injeta tenant_id em todas as requests
      tenant.middleware.spec.ts
    types/
      tool-scope.types.ts     ← interfaces TypeScript
      policy.types.ts
```

### Interfaces TypeScript

```typescript
// tool-scope.types.ts
export interface Tool {
  name:        string
  description: string
  execute:     (params: unknown) => Promise<unknown>
  isWrite:     boolean   // true = tool de mutação (write_*)
}

export interface ToolScope {
  agentId:      string
  tenantId:     string
  autonomyLevel: AutonomyLevel
  tools:        Tool[]          // tools disponíveis para o agente
  policyId:     string
  policyVersion: string
}

export type AutonomyLevel = 'CONSULTIVO' | 'ASSISTIDO' | 'AUTONOMO'
```

```typescript
// policy.types.ts
export interface PolicyConfig {
  id:             string
  tenantId:       string
  name:           string
  autonomyLevel:  AutonomyLevel
  allowedActions: string[]   // prefixos ou nomes exatos de tools
  maxValueBrl?:   number
  timeWindowH?:   number
  approvers:      string[]
  version:        string
}
```

### Implementação — PolicyEngine

```typescript
// policy.engine.ts
import { PrismaClient } from '@prisma/client'
import { ToolScopeBuilder } from './tool-scope.builder'
import { ToolScope } from '../shared/types/tool-scope.types'

export class PolicyEngine {
  constructor(
    private prisma: PrismaClient,
    private scopeBuilder: ToolScopeBuilder,
  ) {}

  async buildScope(agentId: string, tenantId: string): Promise<ToolScope> {
    // 1. Carregar agente + política ativa (sempre filtrado por tenantId)
    const agent = await this.prisma.agent.findFirst({
      where:   { id: agentId, tenantId, status: { not: 'DEPRECATED' } },
      include: { policy: true },
    })

    if (!agent) throw new Error(`Agent ${agentId} not found for tenant ${tenantId}`)
    if (!agent.policy) throw new Error(`Agent ${agentId} has no active policy`)

    // 2. Montar ToolScope conforme nível de autonomia
    const scope = this.scopeBuilder.build({
      agentId:       agent.id,
      tenantId:      agent.tenantId,
      autonomyLevel: agent.policy.autonomyLevel,
      allowedActions: agent.policy.allowedActions,
      policyId:      agent.policy.id,
      policyVersion: agent.policy.version,
    })

    return scope
  }
}
```

### Implementação — ToolScopeBuilder

```typescript
// tool-scope.builder.ts
import { Tool, ToolScope, AutonomyLevel } from '../shared/types/tool-scope.types'
import { ALL_TOOLS } from '../shared/tools/tool-registry'

export class ToolScopeBuilder {
  build(params: {
    agentId:        string
    tenantId:       string
    autonomyLevel:  AutonomyLevel
    allowedActions: string[]
    policyId:       string
    policyVersion:  string
  }): ToolScope {
    const tools = this.filterTools(params.autonomyLevel, params.allowedActions)

    return {
      agentId:       params.agentId,
      tenantId:      params.tenantId,
      autonomyLevel: params.autonomyLevel,
      tools,
      policyId:      params.policyId,
      policyVersion: params.policyVersion,
    }
  }

  private filterTools(level: AutonomyLevel, allowedActions: string[]): Tool[] {
    return ALL_TOOLS.filter(tool => {
      // Consultivo: apenas tools read_*
      if (level === 'CONSULTIVO') return !tool.isWrite

      // Assistido e Autônomo: tools em allowedActions
      return allowedActions.some(action =>
        tool.name === action || tool.name.startsWith(action)
      )
    })
  }
}
```

### Middleware de tenant

```typescript
// tenant.middleware.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthenticatedRequest extends Request {
  tenantId: string
  userId:   string
}

export function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    res.status(401).json({ error: 'Token obrigatório' })
    return
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      tenantId: string
      userId:   string
    }

    if (!payload.tenantId) {
      res.status(401).json({ error: 'tenant_id ausente no token' })
      return
    }

    (req as AuthenticatedRequest).tenantId = payload.tenantId
    ;(req as AuthenticatedRequest).userId   = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido' })
  }
}
```

### Critérios de aceite da sessão 1.2

| # | Critério | Como verificar |
|---|---|---|
| 1 | `PolicyEngine.buildScope` retorna ToolScope com tools `read_*` apenas para agente CONSULTIVO | Teste unitário `policy.engine.spec.ts` |
| 2 | `PolicyEngine.buildScope` retorna ToolScope com tools `write_*` gated para agente ASSISTIDO | Teste unitário |
| 3 | `PolicyEngine.buildScope` lança erro se agente não pertence ao tenant | Teste unitário (edge case) |
| 4 | `tenantMiddleware` rejeita request sem token com 401 | Teste unitário |
| 5 | `tenantMiddleware` rejeita token sem `tenant_id` com 401 | Teste unitário |
| 6 | Nenhuma query Prisma em `PolicyEngine` sem filtro `tenantId` | Code review — regra de lint |
| 7 | Cobertura de testes ≥ 80% nos arquivos da sessão | `pnpm test:coverage` |

### Edge cases obrigatórios (`test/edge/`)

```typescript
// test/edge/policy-engine.edge.spec.ts
describe('PolicyEngine — edge cases', () => {
  it('agente DEPRECATED não deve retornar ToolScope')
  it('agente sem política atribuída deve lançar erro descritivo')
  it('agente de tenant A não deve ser acessível por tenant B')
  it('allowedActions vazio em AUTONOMO deve retornar ToolScope vazio')
  it('tool com nome exato e tool com prefixo devem ambas ser incluídas')
})
```

---

## Sessão 1.3 — Audit trail: gravação e verificação

### Objetivo
Implementar o `AuditService` que grava `AuditEvent` com hash encadeado
SHA-256 e o `AuditVerifier` que valida a integridade da cadeia.

### Interface do AuditService

```typescript
export interface CreateAuditEventInput {
  tenantId:        string
  agentId:         string
  action:          string
  toolCalled?:     string
  inputSummary:    string   // sem PII — resumo da intenção
  outcome:         'EXECUTADO' | 'BLOQUEADO' | 'AGUARDANDO' | 'ESCALADO' | 'ERRO'
  latencyMs:       number
  subjectToken:    string   // HMAC do identificador do titular
  dataCategories:  string[]
  legalBasis:      string
  purpose:         string
  approverId?:     string
  escalationReason?: string
}
```

### Algoritmo de hash encadeado

```typescript
// audit.service.ts (pseudocódigo)
async createEvent(input: CreateAuditEventInput): Promise<AuditEvent> {
  // 1. Buscar hash do último evento do agente (ou '0'.repeat(64) se primeiro)
  const lastEvent = await this.prisma.auditEvent.findFirst({
    where:   { tenantId: input.tenantId, agentId: input.agentId },
    orderBy: { createdAt: 'desc' },
    select:  { hash: true },
  })
  const prevHash = lastEvent?.hash ?? '0'.repeat(64)

  // 2. Montar payload sem o campo hash
  const retentionUntil = new Date()
  retentionUntil.setFullYear(retentionUntil.getFullYear() + 5)

  const payload = { ...input, prevHash, retentionUntil, traceId: uuid() }

  // 3. Calcular hash SHA-256 do payload serializado
  const hash = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')

  // 4. Gravar — append-only (role governa_app não permite UPDATE/DELETE)
  return this.prisma.auditEvent.create({
    data: { ...payload, hash },
  })
}
```

### Critérios de aceite da sessão 1.3

| # | Critério | Como verificar |
|---|---|---|
| 1 | Primeiro evento tem `prevHash = '0'.repeat(64)` | Teste unitário |
| 2 | Segundo evento tem `prevHash` igual ao `hash` do primeiro | Teste unitário |
| 3 | Alterar qualquer campo de um evento quebra a cadeia | Teste de mutação |
| 4 | `AuditVerifier.verify(tenantId, agentId)` retorna `valid: true` para cadeia íntegra | Teste de integração |
| 5 | `AuditVerifier.verify` retorna `valid: false` e índice do evento corrompido | Teste de integração |
| 6 | PII nunca aparece em `inputSummary` — validação via regex no teste | Teste unitário |

---

## Sessão 1.4 — Inventário de agentes

### Objetivo
Endpoints REST para CRUD de agentes com isolamento multi-tenant obrigatório.

### Endpoints

| Método | Path | Descrição |
|---|---|---|
| GET | `/agents` | Lista agentes do tenant autenticado |
| GET | `/agents/:id` | Detalhe do agente (verifica tenant) |
| POST | `/agents` | Cria novo agente |
| PATCH | `/agents/:id` | Atualiza agente (status, policy, tools) |
| POST | `/agents/:id/pause` | Pausa agente (status → PAUSED) |
| POST | `/agents/:id/activate` | Ativa agente (SANDBOX/PAUSED → ACTIVE) |

### Critérios de aceite da sessão 1.4

| # | Critério |
|---|---|
| 1 | `GET /agents` nunca retorna agentes de outro tenant |
| 2 | `PATCH /agents/:id` de tenant errado retorna 404 (não 403 — não vazar existência) |
| 3 | Agente só pode ir para ACTIVE após ter política atribuída |
| 4 | Agente DEPRECATED não pode ser reativado |

---

## Sessão 1.5 — Testes de integração

### Objetivo
Suite de testes de integração cobrindo os fluxos completos do E1,
usando banco real (Testcontainers ou banco de teste dedicado).

### Cobertura mínima

```
apps/governa-core/test/
  integration/
    policy-engine.integration.spec.ts
    audit-trail.integration.spec.ts
    agent-inventory.integration.spec.ts
  edge/
    policy-engine.edge.spec.ts
    audit-trail.edge.spec.ts
    tenant-isolation.edge.spec.ts   ← crítico: cross-tenant attacks
```

### Critério de aceite do E1 completo

- [ ] `pnpm test:coverage` mostra ≥ 80% em todos os módulos do E1
- [ ] Zero queries sem `tenantId` em todos os repositórios
- [ ] Cadeia de hash verificada com ≥ 10 eventos encadeados
- [ ] Todos os edge cases de cross-tenant retornam 404
- [ ] `audit_events` append-only confirmado: tentativa de UPDATE retorna erro de permissão

---

## Dependências externas do E1

| Dependência | Versão | Uso |
|---|---|---|
| `@prisma/client` | 5.22.0 | ORM — queries com isolamento por tenantId |
| `express` | 4.19.x | Framework HTTP |
| `jsonwebtoken` | 9.x | Auth — extração de tenantId do JWT |
| `zod` | 3.23.x | Validação de input nos endpoints |
| `uuid` | 10.x | Geração de traceId |
| `jest` + `ts-jest` | 29.x | Testes unitários e integração |

Todas instaladas via `pnpm install` na sessão 1.1. ✅

---

## Checklist de abertura da sessão 1.2 no Cowork

Antes de iniciar qualquer código:

- [ ] `cd ~/dev/governa && pnpm docker:up` — containers rodando
- [ ] `docker exec governa_postgres pg_isready -U governa -d governa_dev` — banco OK
- [ ] Skill `governa-agentes-totvs` visível em `/mnt/skills/user/`
- [ ] `ANTHROPIC_API_KEY` configurada no `.env`
- [ ] Branch `feat/session-1.2-policy-engine` criada a partir de `main`
