import type { Request, Response, NextFunction, RequestHandler } from 'express'
import jwt, { type JwtPayload } from 'jsonwebtoken'

/**
 * Request enriquecido com identidade do tenant + usuário.
 * Downstream handlers tipam `req as AuthenticatedRequest`.
 */
export interface AuthenticatedRequest extends Request {
  tenantId: string
  userId:   string
}

/**
 * Payload mínimo que o JWT precisa carregar.
 * Aceita campos extras sem invalidar (claims de auth0/keycloak).
 */
interface TenantClaims extends JwtPayload {
  tenantId?: string
  userId?:   string
}

/**
 * Mensagens de erro padronizadas — facilita assertion em testes
 * e mantém respostas estáveis para clients (preferência #1 — dicionário
 * de erros como contrato).
 */
export const TENANT_AUTH_ERRORS = {
  MISSING_TOKEN:    'Token obrigatório',
  INVALID_TOKEN:    'Token inválido',
  MISSING_TENANT:   'tenant_id ausente no token',
  MISSING_USER:     'user_id ausente no token',
} as const

export interface TenantMiddlewareOptions {
  /** Segredo HS256 do JWT. Default: process.env.JWT_SECRET */
  secret?: string
}

/**
 * Factory — devolve um middleware Express que valida o Bearer JWT,
 * extrai `tenantId` + `userId` e os injeta no request.
 *
 * Usar a factory em testes (passa secret literal). Em produção,
 * `tenantMiddleware` (export default) lê do env automaticamente.
 *
 * Códigos de retorno:
 *   401 — token ausente, inválido, expirado, ou sem tenant_id
 *   passa para next() — token válido com tenantId presente
 */
export function createTenantMiddleware(
  options: TenantMiddlewareOptions = {},
): RequestHandler {
  return function tenantMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const secret = options.secret ?? process.env.JWT_SECRET
    if (!secret) {
      // Erro de configuração — não vaza para o client, log e 500
      res.status(500).json({ error: 'JWT_SECRET não configurado' })
      return
    }

    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: TENANT_AUTH_ERRORS.MISSING_TOKEN })
      return
    }

    const token = header.slice('Bearer '.length).trim()
    if (!token) {
      res.status(401).json({ error: TENANT_AUTH_ERRORS.MISSING_TOKEN })
      return
    }

    let claims: TenantClaims
    try {
      const decoded = jwt.verify(token, secret)
      if (typeof decoded === 'string') {
        res.status(401).json({ error: TENANT_AUTH_ERRORS.INVALID_TOKEN })
        return
      }
      claims = decoded as TenantClaims
    } catch {
      res.status(401).json({ error: TENANT_AUTH_ERRORS.INVALID_TOKEN })
      return
    }

    if (!claims.tenantId) {
      res.status(401).json({ error: TENANT_AUTH_ERRORS.MISSING_TENANT })
      return
    }

    if (!claims.userId) {
      res.status(401).json({ error: TENANT_AUTH_ERRORS.MISSING_USER })
      return
    }

    const authedReq = req as AuthenticatedRequest
    authedReq.tenantId = claims.tenantId
    authedReq.userId   = claims.userId

    next()
  }
}

/**
 * Middleware default — usa JWT_SECRET do env. Plugue direto no app.use().
 */
export const tenantMiddleware: RequestHandler = createTenantMiddleware()
