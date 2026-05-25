# GOVERNA_AGENTES_MVP — Entregável 2
## Gateway TOTVS (integração Protheus)
**Target Flex Patrimonial · MVP · v1**

---

## Objetivo do entregável

Client HTTP de integração com o Protheus (ERP TOTVS) funcionando, testado e documentado.
Ao final deste entregável, o `governa-gateway` consegue autenticar-se no Protheus,
buscar pedidos e clientes com validação de schema, aplicar rate limiting e
expor contratos Pact verificáveis pelo `governa-core` e pelo frontend.

### Repositório
`governa-gateway` — repositório separado, criado na sessão 2.1.
Estrutura de monorepo PNPM compatível com o workspace de `governa`.

---

## Sessão 2.1 — Auth Protheus (OAuth 2.0 / Basic)

### Objetivo
Criar o repositório `governa-gateway` e implementar o `ProtheusAuthClient` —
client de autenticação com suporte a OAuth 2.0 (fluxo client_credentials)
e fallback para Basic Auth, com token refresh automático e retry em falha transitória.

### Criação do repositório

```bash
# A partir do diretório pai de governa
mkdir governa-gateway
cd governa-gateway
git init
pnpm init
git remote add origin git@github.com:<org>/governa-gateway.git
```

### Estrutura de arquivos a criar

```
governa-gateway/
  src/
    auth/
      protheus-auth.client.ts         ← lógica principal de autenticação
      protheus-auth.client.spec.ts    ← testes unitários
      token-cache.ts                  ← cache em memória com TTL
      token-cache.spec.ts
    shared/
      http/
        http-client.ts                ← wrapper Axios com interceptors
        http-client.spec.ts
      config/
        protheus.config.ts            ← leitura de variáveis de ambiente
      errors/
        protheus-errors.ts            ← dicionário de erros upstream
      types/
        auth.types.ts
  test/
    edge/
      auth.edge.spec.ts               ← edge cases de autenticação
  .env.example
  package.json
  tsconfig.json
  jest.config.ts
```

### Variáveis de ambiente obrigatórias (`.env.example`)

```env
# Protheus
PROTHEUS_BASE_URL=https://protheus.targetflex.com.br/rest
PROTHEUS_CLIENT_ID=governa_client
PROTHEUS_CLIENT_SECRET=<secret>
PROTHEUS_BASIC_USER=governa_api
PROTHEUS_BASIC_PASS=<password>
PROTHEUS_AUTH_MODE=oauth2          # oauth2 | basic
PROTHEUS_TOKEN_TTL_BUFFER_S=30    # renovar token N segundos antes do vencimento

# HTTP
PROTHEUS_TIMEOUT_MS=10000
PROTHEUS_MAX_RETRIES=3
```

### Interfaces TypeScript

```typescript
// auth.types.ts

export type AuthMode = 'oauth2' | 'basic'

export interface ProtheusTokenResponse {
  access_token: string
  token_type:   string
  expires_in:   number    // segundos
}

export interface CachedToken {
  value:     string
  expiresAt: number      // Date.now() + (expires_in - buffer) * 1000
}

export interface ProtheusAuthConfig {
  baseUrl:         string
  clientId:        string
  clientSecret:    string
  basicUser:       string
  basicPass:       string
  authMode:        AuthMode
  tokenTtlBuffer:  number   // segundos
}
```

### Implementação — ProtheusAuthClient

```typescript
// protheus-auth.client.ts
import axios from 'axios'
import { TokenCache } from './token-cache'
import { ProtheusAuthConfig, ProtheusTokenResponse } from '../shared/types/auth.types'

export class ProtheusAuthClient {
  private cache: TokenCache

  constructor(private readonly config: ProtheusAuthConfig) {
    this.cache = new TokenCache()
  }

  /**
   * Retorna token válido — do cache se ainda vigente, novo se expirado.
   */
  async getToken(): Promise<string> {
    const cached = this.cache.get()
    if (cached) return cached

    return this.config.authMode === 'oauth2'
      ? this.fetchOAuth2Token()
      : this.buildBasicToken()
  }

  private async fetchOAuth2Token(): Promise<string> {
    const response = await axios.post<ProtheusTokenResponse>(
      `${this.config.baseUrl}/oauth2/token`,
      new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )

    const { access_token, expires_in } = response.data
    this.cache.set(access_token, expires_in, this.config.tokenTtlBuffer)
    return access_token
  }

  private buildBasicToken(): string {
    const encoded = Buffer.from(
      `${this.config.basicUser}:${this.config.basicPass}`,
    ).toString('base64')
    return `Basic ${encoded}`
  }

  /**
   * Invalida o cache forçando refresh no próximo getToken().
   * Usar após receber 401 do Protheus.
   */
  invalidate(): void {
    this.cache.clear()
  }
}
```

### Implementação — TokenCache

```typescript
// token-cache.ts
import { CachedToken } from '../shared/types/auth.types'

export class TokenCache {
  private entry: CachedToken | null = null

  get(): string | null {
    if (!this.entry) return null
    if (Date.now() >= this.entry.expiresAt) {
      this.entry = null
      return null
    }
    return this.entry.value
  }

  set(value: string, expiresInSeconds: number, bufferSeconds: number): void {
    this.entry = {
      value,
      expiresAt: Date.now() + (expiresInSeconds - bufferSeconds) * 1000,
    }
  }

  clear(): void {
    this.entry = null
  }
}
```

### Implementação — HttpClient com interceptor de auth

```typescript
// http-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { ProtheusAuthClient } from '../../auth/protheus-auth.client'

export function createHttpClient(
  authClient: ProtheusAuthClient,
  baseURL: string,
  timeoutMs: number,
): AxiosInstance {
  const instance = axios.create({ baseURL, timeout: timeoutMs })

  // Injetar Authorization em toda request
  instance.interceptors.request.use(async (config) => {
    const token = await authClient.getToken()
    config.headers = config.headers ?? {}
    config.headers['Authorization'] =
      token.startsWith('Basic ') ? token : `Bearer ${token}`
    return config
  })

  // Em 401, invalidar cache e tentar uma vez
  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true
        authClient.invalidate()
        const token = await authClient.getToken()
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: token.startsWith('Basic ') ? token : `Bearer ${token}`,
        }
        return instance(originalRequest)
      }
      return Promise.reject(error)
    },
  )

  return instance
}
```

### Critérios de aceite da sessão 2.1

| # | Critério | Como verificar |
|---|---|---|
| 1 | `ProtheusAuthClient.getToken()` retorna token do cache sem nova chamada HTTP | Teste unitário — spy em `axios.post` chamado apenas 1 vez em 2 `getToken()` |
| 2 | Cache invalida automaticamente `bufferSeconds` antes do vencimento | Teste unitário — manipulação de `Date.now` via jest.spyOn |
| 3 | `getToken()` no modo `basic` não faz chamada HTTP | Teste unitário |
| 4 | Ao receber 401, interceptor invalida cache e retenta request uma vez | Teste unitário com axios-mock-adapter |
| 5 | Segunda tentativa após 401 também falha → erro propagado sem loop | Teste unitário (edge case) |
| 6 | `PROTHEUS_BASE_URL` ausente → erro descritivo na inicialização | Teste unitário |
| 7 | Repositório `governa-gateway` criado com `pnpm install` sem erros | Verificação manual |
| 8 | Cobertura ≥ 80% nos módulos da sessão | `pnpm test:coverage` |

### Edge cases obrigatórios (`test/edge/auth.edge.spec.ts`)

```typescript
describe('ProtheusAuthClient — edge cases', () => {
  it('token expirado no exato momento do buffer deve forçar refresh')
  it('dois getToken() simultâneos não devem disparar duas chamadas OAuth2')
  it('authMode inválido deve lançar erro na criação do client')
  it('Protheus retorna expires_in = 0 → token nunca cacheado')
  it('Protheus retorna 500 → erro com código PROTHEUS_AUTH_UNAVAILABLE')
})
```

---

## Sessão 2.2 — Conector `read_protheus_pedido`

### Objetivo
Implementar o conector `read_protheus_pedido` — tool que busca pedidos no
Protheus via `GET /PEDIDO/`, valida o schema da resposta e mapeia erros
upstream para o dicionário de erros do gateway.

### Arquivos a criar

```
governa-gateway/src/
  connectors/
    pedido/
      read-protheus-pedido.connector.ts
      read-protheus-pedido.connector.spec.ts
      pedido.schema.ts                ← Zod schema da resposta Protheus
      pedido.mapper.ts                ← mapeia resposta raw → PedidoInterno
      pedido.mapper.spec.ts
    shared/
      upstream-error.handler.ts       ← dicionário de erros HTTP upstream
  test/
    edge/
      pedido.edge.spec.ts
```

### Interfaces TypeScript

```typescript
// pedido.schema.ts — resposta raw do Protheus
import { z } from 'zod'

export const ProtheusPedidoSchema = z.object({
  C5_NUM:      z.string(),            // número do pedido
  C5_CLIENTE:  z.string(),
  C5_LOJA:     z.string(),
  C5_EMISSAO:  z.string().regex(/^\d{8}$/),  // YYYYMMDD
  C5_VALOR:    z.number(),
  C5_STATUS:   z.enum(['A', 'B', 'E', 'L']), // Aberto/Bloqueado/Encerrado/Liberado
  C5_ITENS:    z.array(z.object({
    D2_COD:    z.string(),
    D2_QUANT:  z.number(),
    D2_PRCVEN: z.number(),
  })),
})

export type ProtheusPedidoRaw = z.infer<typeof ProtheusPedidoSchema>

// Modelo interno — independente da estrutura TOTVS
export interface PedidoInterno {
  numeroPedido:  string
  clienteId:     string
  loja:          string
  dataEmissao:   Date
  valorTotal:    number
  status:        'ABERTO' | 'BLOQUEADO' | 'ENCERRADO' | 'LIBERADO'
  itens:         ItemPedido[]
}

export interface ItemPedido {
  codigoProduto: string
  quantidade:    number
  precoUnitario: number
}
```

### Implementação — Conector

```typescript
// read-protheus-pedido.connector.ts
import { AxiosInstance } from 'axios'
import { ProtheusPedidoSchema, PedidoInterno } from './pedido.schema'
import { PedidoMapper } from './pedido.mapper'
import { handleUpstreamError } from '../shared/upstream-error.handler'

export interface ReadPedidoParams {
  numeroPedido?: string
  clienteId?:    string
  dataInicio?:   string   // YYYYMMDD
  dataFim?:      string   // YYYYMMDD
}

export class ReadProtheusPedidoConnector {
  constructor(
    private readonly http: AxiosInstance,
    private readonly mapper: PedidoMapper,
  ) {}

  async execute(params: ReadPedidoParams): Promise<PedidoInterno[]> {
    let response: unknown

    try {
      const res = await this.http.get('/PEDIDO/', { params: this.buildQuery(params) })
      response = res.data
    } catch (error) {
      throw handleUpstreamError(error, 'read_protheus_pedido')
    }

    // Validar schema — lança ZodError se resposta inválida
    const parsed = this.parseResponse(response)
    return parsed.map((raw) => this.mapper.toInterno(raw))
  }

  private buildQuery(params: ReadPedidoParams): Record<string, string> {
    const q: Record<string, string> = {}
    if (params.numeroPedido) q['C5_NUM']     = params.numeroPedido
    if (params.clienteId)    q['C5_CLIENTE'] = params.clienteId
    if (params.dataInicio)   q['C5_EMISSAO_INI'] = params.dataInicio
    if (params.dataFim)      q['C5_EMISSAO_FIM'] = params.dataFim
    return q
  }

  private parseResponse(data: unknown) {
    // Protheus retorna { items: [...] } ou lista direta
    const list = Array.isArray(data) ? data : (data as any)?.items ?? []
    return list.map((item: unknown) => ProtheusPedidoSchema.parse(item))
  }
}
```

### Dicionário de erros upstream

```typescript
// upstream-error.handler.ts
export class UpstreamError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly source: string,
  ) {
    super(message)
    this.name = 'UpstreamError'
  }
}

const ERROR_MAP: Record<number, { code: string; message: string }> = {
  400: { code: 'PROTHEUS_BAD_REQUEST',       message: 'Parâmetros inválidos enviados ao Protheus' },
  401: { code: 'PROTHEUS_UNAUTHORIZED',      message: 'Credenciais rejeitadas pelo Protheus' },
  403: { code: 'PROTHEUS_FORBIDDEN',         message: 'Acesso não autorizado ao recurso Protheus' },
  404: { code: 'PROTHEUS_NOT_FOUND',         message: 'Recurso não encontrado no Protheus' },
  429: { code: 'PROTHEUS_RATE_LIMITED',      message: 'Rate limit atingido no Protheus' },
  500: { code: 'PROTHEUS_INTERNAL_ERROR',    message: 'Erro interno do Protheus' },
  503: { code: 'PROTHEUS_UNAVAILABLE',       message: 'Protheus temporariamente indisponível' },
}

export function handleUpstreamError(error: unknown, connector: string): UpstreamError {
  const status = (error as any)?.response?.status ?? 0
  const mapped = ERROR_MAP[status] ?? {
    code:    'PROTHEUS_UNKNOWN_ERROR',
    message: 'Erro desconhecido ao comunicar com o Protheus',
  }
  return new UpstreamError(mapped.code, mapped.message, status, connector)
}
```

### Critérios de aceite da sessão 2.2

| # | Critério | Como verificar |
|---|---|---|
| 1 | Resposta válida do Protheus → `PedidoInterno[]` retornado corretamente | Teste unitário com mock HTTP |
| 2 | Resposta com campo ausente → `ZodError` com mensagem descritiva | Teste unitário |
| 3 | Protheus retorna 404 → `UpstreamError` com `code: PROTHEUS_NOT_FOUND` | Teste unitário |
| 4 | Protheus retorna 429 → `UpstreamError` com `code: PROTHEUS_RATE_LIMITED` | Teste unitário |
| 5 | `C5_STATUS` com valor fora do enum → `ZodError` (não silencioso) | Teste unitário |
| 6 | Data `C5_EMISSAO` mapeada corretamente para `Date` ISO | Teste unitário |
| 7 | Cobertura ≥ 80% nos módulos da sessão | `pnpm test:coverage` |

### Edge cases obrigatórios (`test/edge/pedido.edge.spec.ts`)

```typescript
describe('read_protheus_pedido — edge cases', () => {
  it('Protheus retorna lista vazia → retorna array vazio, sem erro')
  it('Protheus retorna itens com D2_QUANT = 0 → mapeado sem erro')
  it('C5_VALOR negativo → mapeado sem erro (nota de crédito)')
  it('resposta mista válida + inválida → falha completa (não parcial)')
  it('timeout → UpstreamError com code PROTHEUS_TIMEOUT')
})
```

---

## Sessão 2.3 — Conector `read_protheus_cliente`

### Objetivo
Implementar o conector `read_protheus_cliente` — tool que busca clientes via
`GET /CLIENTE/` e aplica pseudonimização de PII antes de retornar dados
ao `governa-core`, garantindo conformidade LGPD.

### Arquivos a criar

```
governa-gateway/src/
  connectors/
    cliente/
      read-protheus-cliente.connector.ts
      read-protheus-cliente.connector.spec.ts
      cliente.schema.ts
      cliente.mapper.ts
      cliente.mapper.spec.ts
      pii.pseudonymizer.ts             ← HMAC SHA-256 de campos PII
      pii.pseudonymizer.spec.ts
  test/
    edge/
      cliente.edge.spec.ts
      pii.edge.spec.ts
```

### Interfaces TypeScript

```typescript
// cliente.schema.ts
import { z } from 'zod'

export const ProtheusClienteSchema = z.object({
  A1_COD:      z.string(),
  A1_LOJA:     z.string(),
  A1_NOME:     z.string(),            // PII → pseudonimizar
  A1_CGC:      z.string(),            // CPF/CNPJ → pseudonimizar
  A1_END:      z.string(),            // endereço → pseudonimizar
  A1_EMAIL:    z.string().optional(), // PII → pseudonimizar
  A1_TEL:      z.string().optional(), // PII → pseudonimizar
  A1_MSBLQ:    z.enum(['1', '2']),    // 1=desbloqueado, 2=bloqueado
})

export type ProtheusClienteRaw = z.infer<typeof ProtheusClienteSchema>

// Modelo interno — PII substituída por tokens HMAC
export interface ClienteInterno {
  clienteId:      string
  loja:           string
  nomeToken:      string   // HMAC do nome real
  documentoToken: string   // HMAC do CPF/CNPJ
  enderecoToken:  string   // HMAC do endereço
  emailToken:     string | null
  telefoneToken:  string | null
  bloqueado:      boolean
}
```

### Implementação — PiiPseudonymizer

```typescript
// pii.pseudonymizer.ts
import { createHmac } from 'crypto'

export class PiiPseudonymizer {
  constructor(private readonly secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('PII_HMAC_SECRET deve ter no mínimo 32 caracteres')
    }
  }

  /**
   * Retorna HMAC SHA-256 hex do valor.
   * Mesmo valor sempre produz mesmo token → rastreável internamente,
   * ilegível externamente.
   */
  tokenize(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('hex')
  }

  tokenizeOptional(value: string | undefined | null): string | null {
    if (!value) return null
    return this.tokenize(value)
  }
}
```

### Variáveis de ambiente adicionais

```env
PII_HMAC_SECRET=<mínimo-32-chars>   # rotacionável — quebra todos os tokens ao rodar
```

### Critérios de aceite da sessão 2.3

| # | Critério | Como verificar |
|---|---|---|
| 1 | `ClienteInterno` não contém nome, CPF, e-mail ou telefone em texto claro | Teste de snapshot + regex no output |
| 2 | Mesmo cliente → mesmo `nomeToken` (determinístico) | Teste unitário |
| 3 | Clientes diferentes → tokens diferentes | Teste unitário |
| 4 | `PII_HMAC_SECRET` com menos de 32 chars → erro na inicialização | Teste unitário |
| 5 | Protheus retorna `A1_EMAIL` ausente → `emailToken: null` (sem erro) | Teste unitário |
| 6 | `A1_MSBLQ = '2'` → `bloqueado: true` | Teste unitário |
| 7 | Cobertura ≥ 80% nos módulos da sessão | `pnpm test:coverage` |

### Edge cases obrigatórios (`test/edge/`)

```typescript
// pii.edge.spec.ts
describe('PiiPseudonymizer — edge cases', () => {
  it('valor vazio ("") → não tokenizar, retornar null')
  it('valor só com espaços → tratar como vazio')
  it('token de CPF com formatação diferente (111.222.333-44 vs 11122233344) produz tokens diferentes')
  it('secret rotacionado → token anterior não bate mais com novo token')
})

// cliente.edge.spec.ts
describe('read_protheus_cliente — edge cases', () => {
  it('Protheus retorna cliente bloqueado → mapeado com bloqueado: true')
  it('Protheus retorna lista com 1.000 clientes → sem timeout no mapeamento')
  it('A1_CGC com máscara e sem máscara → ambos tokenizados (sem normalização)')
})
```

---

## Sessão 2.4 — Rate limiting + retry policy

### Objetivo
Implementar camada de rate limiting e política de retry (exponential backoff)
aplicada a todos os conectores do gateway, com timeout global de 10 segundos
e máximo de 3 tentativas.

### Arquivos a criar

```
governa-gateway/src/
  shared/
    retry/
      retry.policy.ts
      retry.policy.spec.ts
    rate-limit/
      rate-limiter.ts
      rate-limiter.spec.ts
    http/
      resilient-http-client.ts        ← HttpClient + retry + rate-limit
      resilient-http-client.spec.ts
  test/
    edge/
      retry.edge.spec.ts
      rate-limit.edge.spec.ts
```

### Interfaces e configuração

```typescript
// retry.policy.ts
export interface RetryConfig {
  maxAttempts:     number   // 3
  initialDelayMs:  number   // 200ms
  backoffFactor:   number   // 2 → 200ms, 400ms, 800ms
  retryableStatuses: number[] // [408, 429, 500, 502, 503, 504]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts:       3,
  initialDelayMs:    200,
  backoffFactor:     2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let attempt = 0
  let delay = config.initialDelayMs

  while (attempt < config.maxAttempts) {
    try {
      return await fn()
    } catch (error) {
      attempt++
      const status = (error as any)?.response?.status

      const isRetryable =
        !status || config.retryableStatuses.includes(status)

      if (!isRetryable || attempt >= config.maxAttempts) {
        throw error
      }

      await sleep(delay)
      delay *= config.backoffFactor
    }
  }

  throw new Error('Unreachable') // TypeScript
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

### Rate Limiter (token bucket simples)

```typescript
// rate-limiter.ts
export interface RateLimiterConfig {
  requestsPerSecond: number   // ex: 10
  burstSize:         number   // ex: 20
}

export class RateLimiter {
  private tokens:        number
  private lastRefillAt:  number

  constructor(private readonly config: RateLimiterConfig) {
    this.tokens       = config.burstSize
    this.lastRefillAt = Date.now()
  }

  async acquire(): Promise<void> {
    this.refill()

    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }

    // Calcular espera até ter 1 token disponível
    const msPerToken = 1000 / this.config.requestsPerSecond
    await sleep(msPerToken)
    this.refill()
    this.tokens -= 1
  }

  private refill(): void {
    const now      = Date.now()
    const elapsed  = (now - this.lastRefillAt) / 1000
    const newTokens = elapsed * this.config.requestsPerSecond

    this.tokens = Math.min(
      this.config.burstSize,
      this.tokens + newTokens,
    )
    this.lastRefillAt = now
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

### Critérios de aceite da sessão 2.4

| # | Critério | Como verificar |
|---|---|---|
| 1 | 3ª tentativa com erro 500 → `UpstreamError` propagado após 3 tentativas | Teste unitário com jest.useFakeTimers |
| 2 | Erro 400 → não retentado (falha imediata) | Teste unitário |
| 3 | Delays de backoff seguem sequência 200ms → 400ms → 800ms | Teste unitário — spy em `setTimeout` |
| 4 | RateLimiter não deixa passar mais de `requestsPerSecond` req/s | Teste unitário com fake timers |
| 5 | Burst de `burstSize` requests imediatos é permitido | Teste unitário |
| 6 | Timeout de 10s é aplicado a toda request do HttpClient | Teste unitário — verificar config Axios |
| 7 | Cobertura ≥ 80% nos módulos da sessão | `pnpm test:coverage` |

### Edge cases obrigatórios (`test/edge/retry.edge.spec.ts`)

```typescript
describe('retry policy — edge cases', () => {
  it('erro de rede (sem response.status) → retentado até maxAttempts')
  it('429 com header Retry-After → respeitar o header se presente')
  it('maxAttempts = 1 → falha imediata sem retry')
  it('delay não acumula entre requests independentes')
})
```

---

## Sessão 2.5 — Testes de contrato (Pact)

### Objetivo
Suite de testes Pact verificando contratos entre:
- **Frontend ↔ governa-core** (consumer-driven)
- **governa-core ↔ governa-gateway** (consumer-driven)
- **governa-gateway ↔ Protheus** (provider verification)

### Arquivos a criar

```
governa-gateway/
  test/
    pact/
      consumer/
        pedido.consumer.pact.spec.ts     ← governa-gateway como consumer do Protheus
        cliente.consumer.pact.spec.ts
      provider/
        gateway.provider.pact.spec.ts    ← governa-gateway como provider do governa-core

governa/apps/governa-core/
  test/
    pact/
      consumer/
        gateway.consumer.pact.spec.ts    ← governa-core como consumer do gateway
      provider/
        core.provider.pact.spec.ts       ← governa-core como provider do frontend
```

### Dependências Pact

```bash
# governa-gateway
pnpm add -D @pact-foundation/pact

# governa-core
pnpm add -D @pact-foundation/pact
```

### Exemplo — Consumer Pact (gateway → Protheus)

```typescript
// pedido.consumer.pact.spec.ts
import { Pact } from '@pact-foundation/pact'
import { ReadProtheusPedidoConnector } from '../../src/connectors/pedido/read-protheus-pedido.connector'

const provider = new Pact({
  consumer: 'governa-gateway',
  provider: 'protheus-rest',
  port:     8090,
  log:      './test/pact/logs/pact.log',
  dir:      './test/pact/pacts',
})

describe('Pact: governa-gateway → protheus-rest (pedido)', () => {
  beforeAll(() => provider.setup())
  afterAll(() => provider.finalize())

  it('GET /PEDIDO/ com número válido → retorna pedido', async () => {
    await provider.addInteraction({
      state:         'pedido 000001 existe',
      uponReceiving: 'GET /PEDIDO/ com C5_NUM=000001',
      withRequest: {
        method: 'GET',
        path:   '/PEDIDO/',
        query:  { C5_NUM: '000001' },
      },
      willRespondWith: {
        status: 200,
        body: [{
          C5_NUM:     '000001',
          C5_CLIENTE: 'CLI001',
          C5_LOJA:    '01',
          C5_EMISSAO: '20260524',
          C5_VALOR:   1500.00,
          C5_STATUS:  'A',
          C5_ITENS:   [{ D2_COD: 'PROD01', D2_QUANT: 2, D2_PRCVEN: 750.00 }],
        }],
      },
    })

    const connector = buildConnector(`http://localhost:8090`)
    const result = await connector.execute({ numeroPedido: '000001' })

    expect(result).toHaveLength(1)
    expect(result[0].numeroPedido).toBe('000001')
    expect(result[0].status).toBe('ABERTO')
  })
})
```

### Critérios de aceite da sessão 2.5

| # | Critério | Como verificar |
|---|---|---|
| 1 | Pact consumer `governa-gateway → protheus-rest` gerado e publicado | `pnpm pact:publish` |
| 2 | Pact consumer `governa-core → governa-gateway` gerado e publicado | `pnpm pact:publish` |
| 3 | Provider verification `governa-gateway` passa todos os contratos do core | `pnpm pact:verify` |
| 4 | Provider verification `governa-core` passa todos os contratos do frontend | `pnpm pact:verify` |
| 5 | Pact broker local (Docker) rodando e acessível | `docker compose up pact-broker` |
| 6 | Contrato inclui caso de erro 404 do Protheus | Pact interaction com `status: 404` |
| 7 | CI falha se provider verification quebrar | GitHub Actions step `pact:verify` |

---

## Dependências externas do E2

| Dependência | Versão | Uso |
|---|---|---|
| `axios` | 1.7.x | HTTP client para requisições ao Protheus |
| `axios-mock-adapter` | 2.x | Mock de requests nos testes unitários |
| `zod` | 3.23.x | Validação de schema das respostas Protheus |
| `@pact-foundation/pact` | 12.x | Testes de contrato consumer/provider |
| `jest` + `ts-jest` | 29.x | Testes unitários e integração |
| `dotenv` | 16.x | Leitura de variáveis de ambiente |

---

## Checklist de abertura da sessão 2.1 no Cowork

Antes de iniciar qualquer código:

- [ ] `governa-gateway/` ainda não existe — criar do zero
- [ ] `.env` do gateway com `PROTHEUS_BASE_URL`, `PROTHEUS_CLIENT_ID`, `PROTHEUS_CLIENT_SECRET` preenchidos
- [ ] `PII_HMAC_SECRET` de no mínimo 32 caracteres definida no `.env`
- [ ] Skill `governa-agentes-totvs` visível e report `2026-05-24-sessao-1.7.md` disponível em `docs/reports/`
- [ ] Branch `feat/session-2.1-protheus-auth` criada a partir de `main`
- [ ] `governa-core` com 39/39 testes de integração verdes (E1 validado)

---

## Critério de aceite do E2 completo

- [ ] `governa-gateway` com `pnpm test:coverage` mostrando ≥ 80% em todos os módulos
- [ ] Todos os contratos Pact publicados e verificados no broker
- [ ] Nenhum campo PII em texto claro em qualquer resposta do gateway
- [ ] Rate limiter validado com carga de 50 req/s sem quebrar SLA de 10s
- [ ] Dicionário de erros upstream com 100% dos códigos HTTP mapeados (4xx + 5xx)
- [ ] `governa-core` consome `governa-gateway` sem modificação (contrato Pact válido)
