import { Router, type Request, type Response } from 'express'
import { AuthService, InvalidCredentialsError } from '../application/auth.service'

export function createAuthRouter(authService: AuthService): Router {
  const router = Router()

  /**
   * POST /auth/login
   * Body: { email: string, password: string }
   * 200 { token, expiresIn } | 400 | 401
   */
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as Record<string, unknown>

    if (typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Campo "email" é obrigatório' })
      return
    }
    if (typeof password !== 'string' || !password) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Campo "password" é obrigatório' })
      return
    }

    try {
      const result = await authService.login({ email, password })
      res.status(200).json(result)
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        res.status(401).json({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' })
        return
      }
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Erro interno' })
    }
  })

  return router
}
