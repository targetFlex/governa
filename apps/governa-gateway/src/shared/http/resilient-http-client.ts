// ============================================================
// resilient-http-client.ts — HttpClient com retry + rate-limit
//
// Combina:
//   - createHttpClient (auth interceptors)
//   - RateLimiter (token bucket — controla throughput)
//   - withRetry (exponential backoff — lida com falhas transitórias)
//
// Timeout padrão: 10 000 ms (CA6 — E2.md §Sessão 2.4)
// ============================================================
import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

import { ProtheusAuthClient }     from '../../auth/protheus-auth.client'
import { createHttpClient }       from './http-client'
import {
  RateLimiter,
  RateLimiterConfig,
}                                 from '../rate-limit/rate-limiter'
import {
  withRetry,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  sleep,
}                                 from '../retry/retry.policy'

export const DEFAULT_TIMEOUT_MS = 10_000

export interface ResilientClientOptions {
  rateLimiterConfig?: RateLimiterConfig
  retryConfig?:       Partial<RetryConfig>
  timeoutMs?:         number
}

/**
 * Wrapper resiliente sobre AxiosInstance.
 * Todas as chamadas passam pelo rate limiter e pelo mecanismo de retry.
 */
export class ResilientHttpClient {
  constructor(
    private readonly instance:     AxiosInstance,
    private readonly rateLimiter?: RateLimiter,
    private readonly retryConfig:  RetryConfig = DEFAULT_RETRY_CONFIG,
    private readonly sleepFn:      (ms: number) => Promise<void> = sleep,
  ) {}

  async get<T = unknown>(
    url:     string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    await this.rateLimiter?.acquire()
    return withRetry(
      () => this.instance.get<T>(url, config),
      this.retryConfig,
      this.sleepFn,
    )
  }

  async post<T = unknown>(
    url:     string,
    data?:   unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    await this.rateLimiter?.acquire()
    return withRetry(
      () => this.instance.post<T>(url, data, config),
      this.retryConfig,
      this.sleepFn,
    )
  }

  /** Expõe instância axios subjacente para inspeção em testes. */
  get axiosInstance(): AxiosInstance {
    return this.instance
  }
}

/**
 * Factory principal — cria ResilientHttpClient com todas as camadas.
 *
 * @param authClient  Client de autenticação Protheus (OAuth2 / Basic).
 * @param baseURL     URL base do Protheus.
 * @param options     Configuração opcional de rate limit, retry e timeout.
 */
export function createResilientHttpClient(
  authClient: ProtheusAuthClient,
  baseURL:    string,
  options:    ResilientClientOptions = {},
): ResilientHttpClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const instance = createHttpClient(authClient, baseURL, timeoutMs)

  const rateLimiter = options.rateLimiterConfig
    ? new RateLimiter(options.rateLimiterConfig)
    : undefined

  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...options.retryConfig,
  }

  return new ResilientHttpClient(instance, rateLimiter, retryConfig)
}
