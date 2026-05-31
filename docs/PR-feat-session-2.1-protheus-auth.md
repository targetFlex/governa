# PR: governa-gateway — Integração TOTVS Protheus (Sessões 2.1–2.8)

**Branch:** `feat/session-2.1-protheus-auth` → `main`  
**Repo:** `targetFlex/governa`  
**Commits:** 10 (sessões 2.1 a 2.8)

---

## Resumo

Implementação completa do `governa-gateway`: serviço Node.js/TypeScript responsável por autenticar, consultar e transformar dados do ERP TOTVS Protheus, expondo contratos consumíveis pelo `governa-core`.

---

## O que foi entregue

### Sessão 2.1 — ProtheusAuthClient
- `ProtheusAuthClient`: autenticação Basic Auth + token JWT Bearer no Protheus REST
- `TokenCache`: cache in-memory com TTL e renovação automática
- 54 testes unitários

### Sessão 2.2 — Conector read_protheus_pedido
- `ReadProtheusPedidoConnector`: busca pedidos por `numeroPedido`
- Zod schema para validação de resposta Protheus
- Mapper domínio → `PedidoInterno`
- 95 testes (conector + mapper + schema)

### Sessão 2.3 — Conector read_protheus_cliente + PiiPseudonymizer
- `ReadProtheusCilenteConnector`: busca clientes por `codigoCliente`
- `PiiPseudonymizer`: pseudonimização HMAC SHA-256 de CPF/CNPJ/e-mail

### Sessão 2.4 — Conector read_protheus_produto
- `ReadProtheusProdutoConnector`: busca produtos por `codigoProduto`
- 47 testes, 100% cobertura

### Sessão 2.5 — Resiliência HTTP
- `RetryPolicy`: retry exponencial com jitter (configurável: tentativas, delay, fator)
- `RateLimiter`: token bucket com janela deslizante
- `ResilientHttpClient`: composição retry + rate limit + circuit breaker

### Sessão 2.6 — Pact consumer/provider
- Consumer pacts: `governa-gateway → protheus-rest` (pedido, cliente)
- Provider verification: `governa-core` verifica contratos CC1-CC4
- Docker Compose com Pact Broker local

### Sessão 2.7 — Testes E2E in-process + cobertura handleAuthError
- 12 testes E2E gateway↔Protheus in-process (sem I/O real)
- `handleAuthError` barrel 100% coberto

### Sessão 2.8 — GatewayHttpServer Express
- `GatewayHttpServer`: Express app com `GET /pedidos` e `GET /clientes`
- Satisfaz contratos CC1-CC4 do governa-core
- Provider pact manual (mesmo padrão do governa-core)
- 15 testes unitários do servidor

---

## Métricas finais

| Métrica | Valor |
|---|---|
| Testes | **307 passando / 27 suites** |
| Statements | **98.29%** |
| Branches | **92.07%** |
| Functions | **96.70%** |
| Threshold | 80% (todos acima) |

---

## Arquitetura

```
governa-gateway/
  src/
    auth/                    # ProtheusAuthClient + TokenCache
    connectors/
      pedido/                # schema, mapper, connector
      cliente/               # schema, mapper, connector
      produto/               # schema, mapper, connector
      shared/                # PiiPseudonymizer, UpstreamErrorHandler
    shared/
      http/                  # HttpClient, ResilientHttpClient
      retry/                 # RetryPolicy
      rate-limit/            # RateLimiter
      errors/                # ProtheusErrors
      config/                # ProtheusConfig
    gateway-app.ts           # GatewayHttpServer (Express, porta 3100)
  test/
    edge/                    # edge cases isolados
    integration/             # E2E in-process
    pact/
      consumer/              # pacts gateway→protheus
      provider/              # verificação CC1-CC4
```

**Padrão:** Hexagonal Architecture — connectors são injetados via interfaces (`IPedidoConnector`, `IClienteConnector`), sem acoplamento ao Express.

---

## Decisões relevantes

- **Verificação pact manual**: Pact Verifier binário retorna 403 em ambiente Linux arm64 (bug Rust FFI). Solução: stateHandlers in-process + HTTP requests manuais — mesmo padrão do `governa-core`.
- **Express via pnpm**: instalado via `pnpm-lock.yaml`; symlinks de sessão de sandbox precisam ser recriados localmente com `pnpm install`.
- **`close()` idempotente**: trata `ERR_SERVER_NOT_RUNNING` como sucesso para evitar falso negativo no ciclo `beforeEach/afterEach`.

---

## Checklist de Review

- [x] Testes passando (307/307)
- [x] Coverage ≥ 80% em todas as dimensões
- [x] Pact contracts CC1-CC4 verificados
- [x] Sem arquivos de debug (`pact-*.js`) no repositório
- [x] Branch em sync com origin
- [ ] Review de código por par
- [ ] CI/CD passa (verificar GitHub Actions)
- [ ] Aprovação antes do merge

---

## Como abrir o PR via CLI

```bash
# Opção 1 — GitHub CLI
gh pr create \
  --repo targetFlex/governa \
  --base main \
  --head feat/session-2.1-protheus-auth \
  --title "feat(gateway): governa-gateway TOTVS Protheus — sessões 2.1-2.8" \
  --body-file governa/docs/PR-feat-session-2.1-protheus-auth.md

# Opção 2 — Interface GitHub
# https://github.com/targetFlex/governa/compare/main...feat/session-2.1-protheus-auth
```
