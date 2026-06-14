// ============================================================
// protheus.config.spec.ts — Testes de leitura e validação de env vars
// ============================================================
import { loadProtheusAuthConfig, loadHttpConfig } from './protheus.config'

const VALID_ENV: Record<string, string> = {
  PROTHEUS_BASE_URL:          'https://protheus.test/rest',
  PROTHEUS_CLIENT_ID:         'cid',
  PROTHEUS_CLIENT_SECRET:     'csec',
  PROTHEUS_BASIC_USER:        'usr',
  PROTHEUS_BASIC_PASS:        'pwd',
  PROTHEUS_AUTH_MODE:         'oauth2',
  PROTHEUS_TOKEN_TTL_BUFFER_S:'30',
  PROTHEUS_TIMEOUT_MS:        '10000',
  PROTHEUS_MAX_RETRIES:       '3',
}

function setEnv(vars: Record<string, string | undefined>) {
  Object.entries(vars).forEach(([k, v]) => {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  })
}

describe('loadProtheusAuthConfig', () => {
  beforeEach(() => setEnv(VALID_ENV))
  afterEach(() => setEnv(Object.fromEntries(Object.keys(VALID_ENV).map(k => [k, undefined]))))

  it('carrega config válida no modo oauth2', () => {
    const cfg = loadProtheusAuthConfig()
    expect(cfg.baseUrl).toBe('https://protheus.test/rest')
    expect(cfg.authMode).toBe('oauth2')
    expect(cfg.tokenTtlBuffer).toBe(30)
  })

  it('carrega config válida no modo basic', () => {
    setEnv({ PROTHEUS_AUTH_MODE: 'basic' })
    const cfg = loadProtheusAuthConfig()
    expect(cfg.authMode).toBe('basic')
  })

  it('usa buffer padrão de 30s quando PROTHEUS_TOKEN_TTL_BUFFER_S ausente', () => {
    setEnv({ PROTHEUS_TOKEN_TTL_BUFFER_S: undefined })
    const cfg = loadProtheusAuthConfig()
    expect(cfg.tokenTtlBuffer).toBe(30)
  })

  it('lança erro descritivo quando PROTHEUS_BASE_URL ausente', () => {
    setEnv({ PROTHEUS_BASE_URL: undefined })
    expect(() => loadProtheusAuthConfig()).toThrow('PROTHEUS_BASE_URL')
  })

  it('lança erro descritivo quando PROTHEUS_CLIENT_ID ausente', () => {
    setEnv({ PROTHEUS_CLIENT_ID: undefined })
    expect(() => loadProtheusAuthConfig()).toThrow('PROTHEUS_CLIENT_ID')
  })

  it('lança erro descritivo quando PROTHEUS_CLIENT_SECRET ausente', () => {
    setEnv({ PROTHEUS_CLIENT_SECRET: undefined })
    expect(() => loadProtheusAuthConfig()).toThrow('PROTHEUS_CLIENT_SECRET')
  })

  it('lança erro descritivo quando PROTHEUS_AUTH_MODE inválido', () => {
    setEnv({ PROTHEUS_AUTH_MODE: 'ldap' })
    expect(() => loadProtheusAuthConfig()).toThrow('PROTHEUS_AUTH_MODE')
  })

  it('lança erro descritivo quando PROTHEUS_AUTH_MODE ausente', () => {
    setEnv({ PROTHEUS_AUTH_MODE: undefined })
    expect(() => loadProtheusAuthConfig()).toThrow('PROTHEUS_AUTH_MODE')
  })
})

describe('loadHttpConfig', () => {
  afterEach(() => {
    delete process.env['PROTHEUS_TIMEOUT_MS']
    delete process.env['PROTHEUS_MAX_RETRIES']
  })

  it('retorna valores padrão quando env vars ausentes', () => {
    delete process.env['PROTHEUS_TIMEOUT_MS']
    delete process.env['PROTHEUS_MAX_RETRIES']
    const cfg = loadHttpConfig()
    expect(cfg.timeoutMs).toBe(10000)
    expect(cfg.maxRetries).toBe(3)
  })

  it('retorna valores configurados quando env vars presentes', () => {
    process.env['PROTHEUS_TIMEOUT_MS'] = '5000'
    process.env['PROTHEUS_MAX_RETRIES'] = '5'
    const cfg = loadHttpConfig()
    expect(cfg.timeoutMs).toBe(5000)
    expect(cfg.maxRetries).toBe(5)
  })
})
