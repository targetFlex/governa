import http from 'http'
import express from 'express'

import { createAuthRouter } from './auth.router'
import { AuthService, InvalidCredentialsError } from '../application/auth.service'

// ─── Setup ───────────────────────────────────────────────────────────────────

let server: http.Server
let baseUrl: string
let loginMock: jest.Mock

async function req(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  const json = await res.json() as Record<string, unknown>
  return { status: res.status, body: json }
}

function startServer(): Promise<void> {
  return new Promise((resolve) => {
    loginMock = jest.fn()
    const authService = { login: loginMock } as unknown as AuthService
    const router = createAuthRouter(authService)

    const app = express()
    app.use(express.json())
    app.use('/auth', router)

    server = http.createServer(app)
    server.listen(0, () => {
      const addr = server.address() as { port: number }
      baseUrl = `http://localhost:${addr.port}`
      resolve()
    })
  })
}

beforeEach(() => startServer())
afterEach(() => new Promise<void>(resolve => server.close(() => resolve())))

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('200 retorna token e expiresIn em caso de sucesso', async () => {
    loginMock.mockResolvedValue({ token: 'jwt.aqui', expiresIn: 28800 })

    const { status, body } = await req({ email: 'admin@governa.com', password: 'secret123' })

    expect(status).toBe(200)
    expect(body).toEqual({ token: 'jwt.aqui', expiresIn: 28800 })
    expect(loginMock).toHaveBeenCalledWith({ email: 'admin@governa.com', password: 'secret123' })
  })

  it('400 quando email está ausente', async () => {
    const { status, body } = await req({ password: 'secret123' })
    expect(status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('400 quando email é string vazia/whitespace', async () => {
    const { status, body } = await req({ email: '   ', password: 'secret123' })
    expect(status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('400 quando password está ausente', async () => {
    const { status, body } = await req({ email: 'admin@governa.com' })
    expect(status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('401 quando credenciais são inválidas', async () => {
    loginMock.mockRejectedValue(new InvalidCredentialsError())

    const { status, body } = await req({ email: 'admin@governa.com', password: 'errada' })

    expect(status).toBe(401)
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('500 quando AuthService lança erro inesperado', async () => {
    loginMock.mockRejectedValue(new Error('conexão com banco perdida'))

    const { status, body } = await req({ email: 'admin@governa.com', password: 'secret123' })

    expect(status).toBe(500)
    expect(body.code).toBe('INTERNAL_ERROR')
  })
})
