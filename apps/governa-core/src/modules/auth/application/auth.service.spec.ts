import jwt from 'jsonwebtoken'
import type { PrismaClient } from '@prisma/client'

import { AuthService, InvalidCredentialsError, hashPassword } from './auth.service'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePrisma(user: unknown) {
  const findUnique = jest.fn().mockResolvedValue(user)
  return {
    prisma:      { user: { findUnique } } as unknown as PrismaClient,
    findUnique,
  }
}

const TENANT_ID = 'tenant-auth-1'
const USER_ID   = 'user-auth-1'

describe('AuthService.login', () => {
  const OLD_ENV = process.env.JWT_SECRET

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret'
  })

  afterAll(() => {
    process.env.JWT_SECRET = OLD_ENV
  })

  it('autentica com sucesso e retorna token JWT válido', async () => {
    const passwordHash = await hashPassword('senha-correta')
    const { prisma, findUnique } = makePrisma({
      id:           USER_ID,
      tenantId:     TENANT_ID,
      email:        'admin@governa.com',
      passwordHash,
      active:       true,
    })

    const service = new AuthService(prisma)
    const result  = await service.login({ email: 'admin@governa.com', password: 'senha-correta' })

    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'admin@governa.com' } })
    expect(result.expiresIn).toBe(8 * 60 * 60)

    const decoded = jwt.verify(result.token, 'test-jwt-secret') as { tenantId: string; userId: string }
    expect(decoded.tenantId).toBe(TENANT_ID)
    expect(decoded.userId).toBe(USER_ID)
  })

  it('normaliza email (lowercase + trim) antes de buscar o usuário', async () => {
    const passwordHash = await hashPassword('senha-correta')
    const { prisma, findUnique } = makePrisma({
      id: USER_ID, tenantId: TENANT_ID, email: 'admin@governa.com', passwordHash, active: true,
    })

    const service = new AuthService(prisma)
    await service.login({ email: '  ADMIN@Governa.com  ', password: 'senha-correta' })

    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'admin@governa.com' } })
  })

  it('lança InvalidCredentialsError quando usuário não existe', async () => {
    const { prisma } = makePrisma(null)
    const service = new AuthService(prisma)

    await expect(service.login({ email: 'inexistente@governa.com', password: 'x' }))
      .rejects.toThrow(InvalidCredentialsError)
  })

  it('lança InvalidCredentialsError quando usuário está inativo', async () => {
    const passwordHash = await hashPassword('senha-correta')
    const { prisma } = makePrisma({
      id: USER_ID, tenantId: TENANT_ID, email: 'admin@governa.com', passwordHash, active: false,
    })
    const service = new AuthService(prisma)

    await expect(service.login({ email: 'admin@governa.com', password: 'senha-correta' }))
      .rejects.toThrow(InvalidCredentialsError)
  })

  it('lança InvalidCredentialsError quando a senha está incorreta', async () => {
    const passwordHash = await hashPassword('senha-correta')
    const { prisma } = makePrisma({
      id: USER_ID, tenantId: TENANT_ID, email: 'admin@governa.com', passwordHash, active: true,
    })
    const service = new AuthService(prisma)

    await expect(service.login({ email: 'admin@governa.com', password: 'senha-errada' }))
      .rejects.toThrow(InvalidCredentialsError)
  })

  it('lança InvalidCredentialsError quando passwordHash armazenado é malformado (sem salt/hash)', async () => {
    const { prisma } = makePrisma({
      id: USER_ID, tenantId: TENANT_ID, email: 'admin@governa.com', passwordHash: 'malformado-sem-separador', active: true,
    })
    const service = new AuthService(prisma)

    await expect(service.login({ email: 'admin@governa.com', password: 'qualquer' }))
      .rejects.toThrow(InvalidCredentialsError)
  })

  it('lança erro quando JWT_SECRET não está configurado', async () => {
    delete process.env.JWT_SECRET
    const passwordHash = await hashPassword('senha-correta')
    const { prisma } = makePrisma({
      id: USER_ID, tenantId: TENANT_ID, email: 'admin@governa.com', passwordHash, active: true,
    })
    const service = new AuthService(prisma)

    await expect(service.login({ email: 'admin@governa.com', password: 'senha-correta' }))
      .rejects.toThrow('JWT_SECRET não configurado')
  })
})

describe('hashPassword', () => {
  it('gera hash no formato salt:hash e permite reautenticação bem-sucedida', async () => {
    const hash = await hashPassword('minha-senha-segura')
    expect(hash).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/)

    process.env.JWT_SECRET = 'test-jwt-secret'
    const { prisma } = makePrisma({
      id: USER_ID, tenantId: TENANT_ID, email: 'x@y.com', passwordHash: hash, active: true,
    })
    const service = new AuthService(prisma)
    await expect(service.login({ email: 'x@y.com', password: 'minha-senha-segura' })).resolves.toBeDefined()
  })

  it('produz hashes diferentes (salt aleatório) para a mesma senha', async () => {
    const hash1 = await hashPassword('mesma-senha')
    const hash2 = await hashPassword('mesma-senha')
    expect(hash1).not.toBe(hash2)
  })
})
