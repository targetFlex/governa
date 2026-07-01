import { createHmac }  from 'crypto'
import * as https      from 'https'
import * as http       from 'http'
import * as nodemailer from 'nodemailer'

import type { NotificationConfigRepository }                from '../domain/notification-config.repository.port'
import type { NotificationConfig, NotificationConfigPatch } from '../domain/notification-config.types'
import type { Alert }                                       from '../domain/alert.types'
import { ALERT_SEVERITIES }                                 from '../domain/alert.types'

// ─── Ports (injeção para testes) ──────────────────────────────────────────────

export interface SmtpOptions {
  host:     string
  port:     number
  secure:   boolean
  user?:    string
  pass?:    string
  from:     string
}

export interface MailSender {
  send(opts: { to: string[]; subject: string; text: string }): Promise<void>
}

export interface HttpPoster {
  post(url: string, body: string, headers: Record<string, string>): Promise<{ status: number }>
}

// ─── Implementações reais ────────────────────────────────────────────────────

export class NodemailerMailSender implements MailSender {
  private readonly transporter: nodemailer.Transporter
  private readonly from: string

  constructor(opts: SmtpOptions) {
    this.from = opts.from
    this.transporter = nodemailer.createTransport({
      host:   opts.host,
      port:   opts.port,
      secure: opts.secure,
      auth:   opts.user ? { user: opts.user, pass: opts.pass } : undefined,
    })
  }

  async send(opts: { to: string[]; subject: string; text: string }): Promise<void> {
    await this.transporter.sendMail({
      from:    this.from,
      to:      opts.to.join(', '),
      subject: opts.subject,
      text:    opts.text,
    })
  }
}

export class NodeHttpPoster implements HttpPoster {
  async post(url: string, body: string, headers: Record<string, string>): Promise<{ status: number }> {
    return new Promise((resolve, reject) => {
      const parsed  = new URL(url)
      const lib     = parsed.protocol === 'https:' ? https : http
      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
      }

      const req = lib.request(options, (res) => {
        res.resume()
        res.on('end', () => resolve({ status: res.statusCode ?? 0 }))
      })

      req.on('error', reject)
      req.setTimeout(10_000, () => { req.destroy(new Error('webhook timeout')) })
      req.write(body)
      req.end()
    })
  }
}

// ─── Serviço principal ───────────────────────────────────────────────────────

const SEVERITY_ORDER = ALERT_SEVERITIES  // ['LOW','MEDIUM','HIGH','CRITICAL']

export class NotificationService {
  constructor(
    private readonly configRepo: NotificationConfigRepository,
    private readonly mail:       MailSender,
    private readonly http:       HttpPoster,
  ) {}

  // ── Despacho após criação de alerta ────────────────────────────────────────

  async dispatch(alert: Alert): Promise<void> {
    const config = await this.configRepo.findByTenant(alert.tenantId)
    if (!config) return

    const alertSeverityIdx = SEVERITY_ORDER.indexOf(alert.severity)
    const minSeverityIdx   = SEVERITY_ORDER.indexOf(config.minSeverity)
    if (alertSeverityIdx < minSeverityIdx) return

    await Promise.allSettled([
      config.emailEnabled && config.emailRecipients.length > 0
        ? this.sendEmail(config, alert)
        : Promise.resolve(),
      config.webhookEnabled && config.webhookUrl
        ? this.sendWebhook(config, alert)
        : Promise.resolve(),
    ])
  }

  // ── CRUD de configuração ────────────────────────────────────────────────────

  async getConfig(tenantId: string): Promise<NotificationConfig | null> {
    return this.configRepo.findByTenant(tenantId)
  }

  async upsertConfig(tenantId: string, patch: NotificationConfigPatch): Promise<NotificationConfig> {
    return this.configRepo.upsert(tenantId, patch)
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  private async sendEmail(config: NotificationConfig, alert: Alert): Promise<void> {
    const subject = `[Governa] Alerta ${alert.severity}: ${alert.kind} — ${alert.message.slice(0, 60)}`
    const text    = [
      `Tenant: ${alert.tenantId}`,
      `Agente: ${alert.agentId}`,
      `Tipo: ${alert.kind}`,
      `Severidade: ${alert.severity}`,
      `Mensagem: ${alert.message}`,
      `Criado em: ${alert.createdAt.toISOString()}`,
    ].join('\n')

    await this.mail.send({ to: config.emailRecipients, subject, text })
  }

  private async sendWebhook(config: NotificationConfig, alert: Alert): Promise<void> {
    const body      = JSON.stringify({ event: 'alert.created', data: alert })
    const signature = config.webhookSecret
      ? 'sha256=' + createHmac('sha256', config.webhookSecret).update(body).digest('hex')
      : ''

    const headers: Record<string, string> = {}
    if (signature) headers['X-Governa-Signature'] = signature

    await this.http.post(config.webhookUrl!, body, headers)
  }
}
