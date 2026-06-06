// ============================================================
// retry.policy.ts — Política de retry com exponential backoff
//
// Contratos:
//   - maxAttempts: total de chamadas (não re-tentativas); 3 = chama fn() 3x
//   - retryableStatuses: só retenta se o status HTTP estiver na lista
//     ou se não houver status (erro de rede)
//   - sleepFn: injetável para testes (padrão: setTimeout real)
//
// Sequência de delay: initialDelayMs × backoffFactor^n
//   ex: 200ms → 400ms → 800ms (backoffFactor = 2)
// ============================================================

export interface RetryConfig {
  /** Número máximo de chamadas a fn() (inclui a primeira). */
  maxAttempts:       number
  /** Delay inicial antes da 2ª tentativa (ms). */
  initialDelayMs:    number
  /** Multiplicador de delay a cada retry. */
  backoffFactor:     number
  /** Status HTTP considerados transitórios (retentáveis). */
  retryableStatuses: number[]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts:       3,
  initialDelayMs:    200,
  backoffFactor:     2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
}

/** Wrapper de setTimeout — substituível em testes. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Executa fn() com retry automático em caso de falha transitória.
 *
 * @param fn        Função assíncrona a executar.
 * @param config    Configuração de retry (padrão: DEFAULT_RETRY_CONFIG).
 * @param sleepFn   Função de espera — injetável para testes sem timer real.
 */
export async function withRetry<T>(
  fn:      () => Promise<T>,
  config:  RetryConfig = DEFAULT_RETRY_CONFIG,
  sleepFn: (ms: number) => Promise<void> = sleep,
): Promise<T> {
  let attempt = 0
  let delay   = config.initialDelayMs

  while (attempt < config.maxAttempts) {
    try {
      return await fn()
    } catch (error: unknown) {
      attempt++

      const status: number | undefined = (error as any)?.response?.status

      // Sem status → erro de rede → retentável
      const isRetryable =
        status === undefined || config.retryableStatuses.includes(status)

      if (!isRetryable || attempt >= config.maxAttempts) {
        throw error
      }

      await sleepFn(delay)
      delay = Math.round(delay * config.backoffFactor)
    }
  }

  // Linha defensiva — não atingível com maxAttempts >= 1
  throw new Error('withRetry: maxAttempts deve ser >= 1')
}
