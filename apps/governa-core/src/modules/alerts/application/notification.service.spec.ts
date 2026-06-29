import { NotificationService } from './notification.service'
import type { MailSender, HttpPoster } from './notification.service'
import type { NotificationConfigRepository } from '../domain/notification-config.repository.port'
import type { NotificationConfig } from '../domain/notification-config.types'
import type { Alert } from '../domain/alert.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeConfig = (overrides: Partial<NotificationConfig> = {}): NotificationConfig => ({
  id:              'cfg-1',
  tenantId:        'tenant-1',
  emailEnabled:    false,
  emailRecipients: [],
  webhookEnabled:  false,
  webhookUrl:      null,
  webhookSecret:   null,
  minSeverity:     'HIGH',
  updatedAt:       new Date(),
  ...overrides,
})

const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id:        'alert-1',
  tenantId:  'tenant-1',
  agentId:   'agent-1',
  kind:      'TOOL_BLOCKED',
  severity:  'HIGH',
  status:    'OPEN',
  message:   'Tool bloqueada por política',
  metadata:  {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeDeps = (configOverride: Partial<NotificationConfig> | null = {}) => {
  const mailSend = jest.fn().mockResolvedValue(undefined)
  const httpPost = jest.fn().mockResolvedValue({ status: 200 })

  const mail:   MailSender   = { send: mailSend }
  const http:   HttpPoster   = { post: httpPost }

  const findByTenant = jest.fn().mockResolvedValue(
    configOverride === null ? null : makeConfig(configOverride),
  )
  const upsert = jest.fn().mockImplementation((_tid: string, patch: object) =>
    Promise.resolve(makeConfig(patch as Partial<NotificationConfig>)),
  )
  const configRepo: NotificationConfigRepository = { findByTenant, upsert }

  const service = new NotificationService(configRepo, mail, http)
  return { service, mailSend, httpPost, findByTenant, upsert }
}

// ─── dispatch ────────────────────────────────────────────────────────────────

describe('NotificationService.dispatch', () => {
  it('não faz nada quando não existe config para o tenant', async () => {
    const { service, mailSend, httpPost } = makeDeps(null)
    await service.dispatch(makeAlert())
    expect(mailSend).not.toHaveBeenCalled()
    expect(httpPost).not.toHaveBeenCalled()
  })

  it('não envia quando severidade do alerta está abaixo de minSeverity', async () => {
    const { service, mailSend, httpPost } = makeDeps({
      emailEnabled:    true,
      emailRecipients: ['ops@target.com'],
      minSeverity:     'CRITICAL',
    })
    await service.dispatch(makeAlert({ severity: 'HIGH' }))
    expect(mailSend).not.toHaveBeenCalled()
    expect(httpPost).not.toHaveBeenCalled()
  })

  it('envia e-mail quando emailEnabled e severidade >= minSeverity', async () => {
    const { service, mailSend } = makeDeps({
      emailEnabled:    true,
      emailRecipients: ['ops@target.com', 'dpo@target.com'],
      minSeverity:     'HIGH',
    })
    await service.dispatch(makeAlert({ severity: 'HIGH' }))
    expect(mailSend).toHaveBeenCalledTimes(1)
    const call = mailSend.mock.calls[0][0]
    expect(call.to).toEqual(['ops@target.com', 'dpo@target.com'])
    expect(call.subject).toContain('HIGH')
    expect(call.subject).toContain('TOOL_BLOCKED')
  })

  it('envia webhook com assinatura HMAC quando webhookEnabled e secret definido', async () => {
    const { service, httpPost } = makeDeps({
      webhookEnabled: true,
      webhookUrl:     'https://hooks.target.com/governa',
      webhookSecret:  'super-secret-key-abc123',
      minSeverity:    'HIGH',
    })
    await service.dispatch(makeAlert())
    expect(httpPost).toHaveBeenCalledTimes(1)
    const [url, body, headers] = httpPost.mock.calls[0]
    expect(url).toBe('https://hooks.target.com/governa')
    expect(JSON.parse(body).event).toBe('alert.created')
    expect(headers['X-Governa-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  it('envia webhook sem assinatura quando webhookSecret é null', async () => {
    const { service, httpPost } = makeDeps({
      webhookEnabled: true,
      webhookUrl:     'https://hooks.target.com/governa',
      webhookSecret:  null,
      minSeverity:    'LOW',
    })
    await service.dispatch(makeAlert({ severity: 'LOW' }))
    expect(httpPost).toHaveBeenCalledTimes(1)
    const [, , headers] = httpPost.mock.calls[0]
    expect(headers['X-Governa-Signature']).toBeUndefined()
  })

  it('envia e-mail e webhook em paralelo quando ambos estão habilitados', async () => {
    const { service, mailSend, httpPost } = makeDeps({
      emailEnabled:    true,
      emailRecipients: ['ops@target.com'],
      webhookEnabled:  true,
      webhookUrl:      'https://hooks.target.com/governa',
      webhookSecret:   null,
      minSeverity:     'HIGH',
    })
    await service.dispatch(makeAlert())
    expect(mailSend).toHaveBeenCalledTimes(1)
    expect(httpPost).toHaveBeenCalledTimes(1)
  })

  it('não envia e-mail quando emailEnabled mas lista de destinatários está vazia', async () => {
    const { service, mailSend } = makeDeps({
      emailEnabled:    true,
      emailRecipients: [],
      minSeverity:     'LOW',
    })
    await service.dispatch(makeAlert({ severity: 'CRITICAL' }))
    expect(mailSend).not.toHaveBeenCalled()
  })
})

// ─── getConfig / upsertConfig ────────────────────────────────────────────────

describe('NotificationService.getConfig', () => {
  it('retorna null quando tenant não tem configuração', async () => {
    const { service } = makeDeps(null)
    const result = await service.getConfig('tenant-1')
    expect(result).toBeNull()
  })

  it('retorna a config existente', async () => {
    const { service } = makeDeps({ emailEnabled: true })
    const result = await service.getConfig('tenant-1')
    expect(result?.emailEnabled).toBe(true)
  })
})

describe('NotificationService.upsertConfig', () => {
  it('delega patch ao repositório e retorna config atualizada', async () => {
    const { service, upsert } = makeDeps()
    const patch = { emailEnabled: true, emailRecipients: ['x@y.com'] }
    await service.upsertConfig('tenant-1', patch)
    expect(upsert).toHaveBeenCalledWith('tenant-1', patch)
  })
})
