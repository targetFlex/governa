// ============================================================
// token-cache.spec.ts — Testes unitários do TokenCache
// ============================================================
import { TokenCache } from './token-cache'

describe('TokenCache', () => {
  let cache: TokenCache

  beforeEach(() => {
    cache = new TokenCache()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // ----------------------------------------------------------
  // Critério 2: cache invalida automaticamente antes do buffer
  // ----------------------------------------------------------
  it('retorna null quando vazio', () => {
    expect(cache.get()).toBeNull()
  })

  it('retorna o token quando ainda vigente', () => {
    cache.set('tok-abc', 3600, 30)
    expect(cache.get()).toBe('tok-abc')
  })

  it('invalida automaticamente quando expiresAt é atingido', () => {
    cache.set('tok-abc', 60, 0)  // TTL 60s, sem buffer
    jest.advanceTimersByTime(60_001)
    expect(cache.get()).toBeNull()
  })

  it('aplica buffer: invalida bufferSeconds antes do vencimento nominal', () => {
    // expires_in=60, buffer=30 → expiresAt = now + 30s
    cache.set('tok-abc', 60, 30)
    jest.advanceTimersByTime(29_999)
    expect(cache.get()).toBe('tok-abc')   // ainda vigente

    jest.advanceTimersByTime(2)            // passa dos 30s
    expect(cache.get()).toBeNull()         // expirou pelo buffer
  })

  it('clear() invalida o token imediatamente', () => {
    cache.set('tok-abc', 3600, 30)
    cache.clear()
    expect(cache.get()).toBeNull()
  })

  it('set() com expires_in <= bufferSeconds NÃO cacheia (TTL ≤ 0)', () => {
    cache.set('tok-zero', 0, 30)   // expires_in=0 → nunca cachear
    expect(cache.get()).toBeNull()
  })

  it('set() substitui token anterior', () => {
    cache.set('tok-old', 3600, 30)
    cache.set('tok-new', 3600, 30)
    expect(cache.get()).toBe('tok-new')
  })

  it('expiresAt é nulo quando cache está vazio', () => {
    expect(cache.expiresAt).toBeNull()
  })

  it('expiresAt tem valor correto após set()', () => {
    const before = Date.now()
    cache.set('tok', 100, 10)  // TTL efetivo = 90s
    const expected = before + 90_000
    // tolerância de 10ms para execução
    expect(cache.expiresAt).toBeGreaterThanOrEqual(expected - 10)
    expect(cache.expiresAt).toBeLessThanOrEqual(expected + 10)
  })
})
