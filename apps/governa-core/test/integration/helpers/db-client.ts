import path from 'path'

import { config as dotenvConfig } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Garante que DATABASE_URL está disponível nas variáveis de ambiente
// antes de qualquer instância do PrismaClient ser criada.
dotenvConfig({ path: path.resolve(__dirname, '../../../.env') })

/**
 * Cria um PrismaClient apontando para o banco de testes.
 *
 * Prioridade de URL:
 *   1. TEST_DATABASE_URL (banco isolado de testes, recomendado em CI)
 *   2. DATABASE_URL do .env (docker-compose padrão do projeto)
 *
 * Logs desabilitados intencionalmente — saída verbosa polui o output do Jest.
 */
export function createTestPrisma(): PrismaClient {
  const url = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL']
  return new PrismaClient({
    datasources: { db: { url } },
    log: [],
  })
}

/**
 * Cria um tenant de teste com slug único e retorna seu id.
 * O tenant é a âncora FK de todos os dados criados na suite —
 * deletar o tenant com deleteTestTenant() limpa tudo em cascata.
 */
export async function createTestTenant(
  prisma: PrismaClient,
  label: string,
): Promise<string> {
  // slug único para evitar colisão entre suites paralelas
  const slug   = `test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const tenant = await prisma.tenant.create({
    data: { name: `[TEST] ${label}`, slug, plan: 'STARTER', active: true },
  })
  return tenant.id
}

/**
 * Limpa todos os dados do tenant em ordem FK-safe:
 *   AuditEvent → PendingAction → Agent (policyId=null first) → Policy → Tenant
 *
 * Invariante: nunca deixa registros órfãos após a suite.
 */
export async function deleteTestTenant(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  await prisma.auditEvent.deleteMany({ where: { tenantId } })
  await prisma.pendingAction.deleteMany({ where: { tenantId } })
  // Desacopla policy antes de deletar agents (FK nullable)
  await prisma.agent.updateMany({ where: { tenantId }, data: { policyId: null } })
  await prisma.agent.deleteMany({ where: { tenantId } })
  await prisma.policy.deleteMany({ where: { tenantId } })
  await prisma.tenant.deleteMany({ where: { id: tenantId } })
}
