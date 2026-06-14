import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

import {
  TENANT_AUTH_ERRORS,
  createTenantMiddleware,
  type AuthenticatedRequest,
} from './tenant.middleware'

const SECRET = 'test-secret-32-chars-long-______________'

interface MockResponse extends Partial<Response> {
  status: jest.Mock
  json:   jest.Mock
}

function mockRes(): MockResponse {
  const res: Partial<Response> = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json   = jest.fn().mockReturnValue(res)
  return res as MockResponse
}

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request
}

describe('tenantMiddleware', () => {
  const middleware = createTenantMiddleware({ secret: SECRET })

  describe('Given a request without Authorization header', () => {
    it('When middleware runs Then responds 401 with MISSING_TOKEN', () => {
      const req  = mockReq()
      const res  = mockRes()
      const next = jest.fn() as NextFunction

      middleware(req, res as unknown as Response, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: TENANT_AUTH_ERRORS.MISSING_TOKEN })
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('Given a request with malformed Authorization header', () => {
    it('When header lacks Bearer prefix Then responds 401 MISSING_TOKEN', () => {
      const req  = mockReq({ authorization: 'totally-not-a-bearer-token' })
      const res  = mockRes()
      const next = jest.fn() as NextFunction

      middleware(req, res as unknown as Response, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: TENANT_AUTH_ERRORS.MISSING_TOKEN })
    })
  })

  describe('Given a request with invalid JWT signature', () => {
    it('When middleware runs Then responds 401 INVALID_TOKEN', () => {
      const tampered = jwt.sign({ tenantId: 'tenant-1', userId: 'u-1' }, 'wrong-secret')
      const req  = mockReq({ authorization: `Bearer ${tampered}` })
      const res  = mockRes()
      const next = jest.fn() as NextFunction

      middleware(req, res as unknown as Response, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: TENANT_AUTH_ERRORS.INVALID_TOKEN })
    })
  })

  describe('Given a request with valid JWT but no tenantId claim', () => {
    it('When middleware runs Then responds 401 MISSING_TENANT', () => {
      const token = jwt.sign({ userId: 'u-1' }, SECRET)
      const req   = mockReq({ authorization: `Bearer ${token}` })
      const res   = mockRes()
      const next  = jest.fn() as NextFunction

      middleware(req, res as unknown as Response, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: TENANT_AUTH_ERRORS.MISSING_TENANT })
    })
  })

  describe('Given a request with valid JWT but no userId claim', () => {
    it('When middleware runs Then responds 401 MISSING_USER', () => {
      const token = jwt.sign({ tenantId: 'tenant-1' }, SECRET)
      const req   = mockReq({ authorization: `Bearer ${token}` })
      const res   = mockRes()
      const next  = jest.fn() as NextFunction

      middleware(req, res as unknown as Response, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: TENANT_AUTH_ERRORS.MISSING_USER })
    })
  })

  describe('Given a Bearer header with empty token after prefix', () => {
    it('When middleware runs Then responds 401 MISSING_TOKEN', () => {
      const req  = mockReq({ authorization: 'Bearer    ' })
      const res  = mockRes()
      const next = jest.fn() as NextFunction

      middleware(req, res as unknown as Response, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: TENANT_AUTH_ERRORS.MISSING_TOKEN })
    })
  })

  describe('Given a JWT signed as a plain string payload (non-object)', () => {
    it('When middleware runs Then responds 401 INVALID_TOKEN', () => {
      // jwt.sign aceita string como subject; verify devolve string nesse caso
      const token = jwt.sign('just-a-string', SECRET)
      const req   = mockReq({ authorization: `Bearer ${token}` })
      const res   = mockRes()
      const next  = jest.fn() as NextFunction

      middleware(req, res as unknown as Response, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: TENANT_AUTH_ERRORS.INVALID_TOKEN })
    })
  })

  describe('Given a request with a fully valid JWT', () => {
    it('When middleware runs Then injects tenantId + userId and calls next()', () => {
      const token = jwt.sign({ tenantId: 'tenant-42', userId: 'user-abc' }, SECRET)
      const req   = mockReq({ authorization: `Bearer ${token}` })
      const res   = mockRes()
      const next  = jest.fn() as NextFunction

      middleware(req, res as unknown as Response, next)

      const authed = req as AuthenticatedRequest
      expect(authed.tenantId).toBe('tenant-42')
      expect(authed.userId).toBe('user-abc')
      expect(next).toHaveBeenCalledTimes(1)
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('Given the middleware was created without a secret AND env lacks JWT_SECRET', () => {
    it('When middleware runs Then responds 500 (config error)', () => {
      const original = process.env.JWT_SECRET
      delete process.env.JWT_SECRET

      const mw   = createTenantMiddleware()
      const req  = mockReq({ authorization: 'Bearer whatever' })
      const res  = mockRes()
      const next = jest.fn() as NextFunction

      mw(req, res as unknown as Response, next)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(next).not.toHaveBeenCalled()

      if (original !== undefined) process.env.JWT_SECRET = original
    })
  })
})
