import { scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import jwt from 'jsonwebtoken'
import type { PrismaClient } from '@prisma/client'

const scryptAsync = promisify(scrypt)

const TOKEN_EXPIRY_SECONDS = 8 * 60 * 60 // 8h

export interface LoginInput {
  email:    string
  password: string
}

export interface LoginOutput {
  token:     string
  expiresIn: number
}

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async login(input: LoginInput): Promise<LoginOutput> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    })

    if (!user || !user.active) {
      throw new InvalidCredentialsError()
    }

    const valid = await verifyPassword(input.password, user.passwordHash)
    if (!valid) {
      throw new InvalidCredentialsError()
    }

    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET não configurado')

    const token = jwt.sign(
      { tenantId: user.tenantId, userId: user.id },
      secret,
      { expiresIn: TOKEN_EXPIRY_SECONDS },
    )

    return { token, expiresIn: TOKEN_EXPIRY_SECONDS }
  }
}

export class InvalidCredentialsError extends Error {
  constructor() { super('Credenciais inválidas') }
}

// ── Utilitários de hash (usados também no seed) ──────────────

export async function hashPassword(password: string): Promise<string> {
  const { randomBytes } = await import('crypto')
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const derived  = (await scryptAsync(password, salt, 64)) as Buffer
  const expected = Buffer.from(hash, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}
