// ============================================================
// gateway-app.ts
//
// GatewayHttpServer — servidor Express que expõe os conectores
// Protheus como API REST consumida pelo governa-core.
//
// Rotas implementadas:
//   POST /auth/login               → 200 { token, expiresIn } | 400 | 401 | 502
//   GET  /pedidos?numeroPedido=xxx → 200 { data: PedidoInterno[] } | 404
//   GET  /clientes?codigoCliente=xxx → 200 { data: ClienteInterno[] } | 404
//
// Porta padrão: 3100 (sobrescrita via GATEWAY_PORT ou listen(port))
//
// Arquitetura: porta de saída (connectors) injetada no construtor
// seguindo Hexagonal Architecture — testável sem Protheus real.
// ============================================================

import express, { Application, Request, Response } from 'express'
import { Server } from 'http'
import { ReadPedidoParams } from './connectors/pedido/read-protheus-pedido.connector'
import { ReadClienteParams } from './connectors/cliente/read-protheus-cliente.connector'
import { IAuthLoginConnector, LoginResult } from './connectors/auth/auth-login.connector'
import { UpstreamError } from './connectors/shared/upstream-error.handler'

// ── Interfaces de porta (facilitam mocking em testes) ────────

export interface IPedidoConnector {
  execute(params: ReadPedidoParams): Promise<import('./connectors/pedido/pedido.schema').PedidoInterno[]>
}

export interface IClienteConnector {
  execute(params: ReadClienteParams): Promise<import('./connectors/cliente/cliente.schema').ClienteInterno[]>
}

export { IAuthLoginConnector }

// ── Formato de erro estruturado (contratos CC2, CC4) ─────────

interface ErrorResponse {
  code: string
  message: string
}

// ── GatewayHttpServer ─────────────────────────────────────────

export class GatewayHttpServer {
  private readonly app: Application
  private server: Server | null = null

  constructor(
    private readonly pedidoConnector: IPedidoConnector,
    private readonly clienteConnector: IClienteConnector,
    private readonly authLoginConnector: IAuthLoginConnector,
  ) {
    this.app = express()
    this.app.use(express.json())
    this.setupRoutes()
  }

  // ── Rotas ────────────────────────────────────────────────────

  private setupRoutes(): void {
    this.app.get('/health', (_req, res) => { res.json({ status: 'ok' }) })
    this.app.post('/auth/login', this.handleLogin.bind(this))
    this.app.get('/pedidos',     this.handlePedidos.bind(this))
    this.app.get('/clientes',    this.handleClientes.bind(this))
  }

  /**
   * POST /auth/login
   *
   * Body: { email: string, password: string }
   *
   * AL-OK: credenciais válidas      → 200 { token, expiresIn }
   * AL-400: body inválido/incompleto → 400 { code: 'VALIDATION_ERROR', message }
   * AL-401: credenciais rejeitadas   → 401 { code: 'UNAUTHORIZED', message }
   * AL-502: Protheus indisponível    → 502 { code, message }
   */
  private async handleLogin(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as Record<string, unknown>

    // Validação de entrada
    if (typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Campo "email" é obrigatório' })
      return
    }
    if (typeof password !== 'string' || !password) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Campo "password" é obrigatório' })
      return
    }

    try {
      const result: LoginResult = await this.authLoginConnector.execute({ email: email.trim(), password })
      res.status(200).json(result)
    } catch (err) {
      this.sendLoginError(res, err)
    }
  }

  /**
   * GET /pedidos
   *
   * Query params: numeroPedido?, clienteId?, dataInicio?, dataFim?
   *
   * CC1: numeroPedido existe       → 200 { data: PedidoInterno[] }
   * CC2: numeroPedido não encontrado → 404 { code, message }
   */
  private async handlePedidos(req: Request, res: Response): Promise<void> {
    const { numeroPedido, clienteId, dataInicio, dataFim } = req.query as Record<string, string | undefined>

    try {
      const pedidos = await this.pedidoConnector.execute({ numeroPedido, clienteId, dataInicio, dataFim })

      if (pedidos.length === 0) {
        res.status(404).json(this.notFound())
        return
      }

      res.status(200).json({ data: pedidos })
    } catch (err) {
      this.sendError(res, err)
    }
  }

  /**
   * GET /clientes
   *
   * Query params: codigoCliente?, loja?, cgc?, ativo?
   *
   * CC3: codigoCliente existe       → 200 { data: ClienteInterno[] }
   * CC4: codigoCliente não encontrado → 404 { code, message }
   */
  private async handleClientes(req: Request, res: Response): Promise<void> {
    const { codigoCliente, loja, cgc, ativo } = req.query as Record<string, string | undefined>

    try {
      const clientes = await this.clienteConnector.execute({
        codigoCliente,
        loja,
        cgc,
        ativo: ativo as 'S' | 'N' | undefined,
      })

      if (clientes.length === 0) {
        res.status(404).json(this.notFound())
        return
      }

      res.status(200).json({ data: clientes })
    } catch (err) {
      this.sendError(res, err)
    }
  }

  // ── Tratamento de erros ──────────────────────────────────────

  private sendLoginError(res: Response, err: unknown): void {
    if (err instanceof UpstreamError) {
      if (err.code === 'PROTHEUS_UNAUTHORIZED') {
        res.status(401).json({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' })
        return
      }
      res.status(502).json({ code: err.code, message: err.message })
      return
    }
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' })
  }

  private sendError(res: Response, err: unknown): void {
    if (err instanceof UpstreamError) {
      // NOT_FOUND do upstream → 404 com envelope de contrato
      if (err.code === 'PROTHEUS_NOT_FOUND') {
        res.status(404).json(this.notFound())
        return
      }
      // Timeout, internal error, auth failure → 502 Bad Gateway
      res.status(502).json({ code: err.code, message: err.message })
      return
    }
    // ZodError ou erro inesperado → 500
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' })
  }

  private notFound(): ErrorResponse {
    return { code: 'NOT_FOUND', message: 'Recurso não encontrado' }
  }

  // ── Ciclo de vida ────────────────────────────────────────────

  /**
   * Inicia o servidor na porta especificada.
   * Retorna a porta efetiva (útil quando port=0, porta aleatória).
   */
  listen(port = 3100): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, () => {
        const addr = this.server!.address()
        const effectivePort = typeof addr === 'object' && addr !== null ? addr.port : port
        resolve(effectivePort)
      })
      this.server.once('error', reject)
    })
  }

  /**
   * Encerra o servidor graciosamente.
   * Idempotente: resolve sem erro se o servidor já estiver fechado.
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) { resolve(); return }
      this.server.close((err) => {
        // "Server is not running" → já fechado, tratar como sucesso
        if (err && (err as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
          reject(err)
          return
        }
        resolve()
      })
    })
  }

  /** Expõe a instância Express (útil para supertest / provider pact) */
  get expressApp(): Application {
    return this.app
  }
}
